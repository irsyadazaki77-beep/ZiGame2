import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { apiRouter } from "./src/server/apiRouter";
import { serverLogger } from "./src/server/logger";
import { requestCorrelationMiddleware, handleServerException } from "./src/server/requestContext";
import { securityHeadersMiddleware, sanitizePayloadMiddleware } from "./src/server/securityMiddleware";
import { APP_VERSION } from "./src/config/version";
import { FatalError } from "./src/server/errors";
import firebaseAppletConfig from "./firebase-applet-config.json";

export { FatalError };

const activeProjectId = process.env.FIREBASE_PROJECT_ID || (!firebaseAppletConfig.projectId?.includes('YOUR_FIREBASE_PROJECT_ID') ? firebaseAppletConfig.projectId : undefined);

/**
 * Safely parses service account credentials from raw JSON string, base64-encoded string,
 * or returns null if the string is empty or invalid JSON.
 */
export function parseServiceAccountCredentials(raw: string | undefined): Record<string, any> | null {
  if (!raw || typeof raw !== 'string') return null;
  const trimmed = raw.trim();
  if (!trimmed) return null;

  // Direct JSON parse attempt
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed && typeof parsed === 'object' && parsed.project_id) {
      return parsed;
    }
  } catch {}

  // Base64-encoded JSON parse attempt
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed && typeof parsed === 'object' && parsed.project_id) {
      return parsed;
    }
  } catch {}

  return null;
}

/**
 * Fail-fast production environment validator.
 * Throws FatalError (and halts the process when exitOnFatal is enabled) if running in
 * NODE_ENV=production without defined Firebase Admin credentials or Cloud Run identity,
 * preventing silent fallback to the in-memory store in production.
 */
export function validateEnvironment(
  env: NodeJS.ProcessEnv = process.env,
  options: { exitOnFatal?: boolean } = {}
): void {
  if (env.NODE_ENV === 'production') {
    const rawServiceAccount = env.FIREBASE_SERVICE_ACCOUNT?.trim();
    const parsedServiceAccount = parseServiceAccountCredentials(rawServiceAccount);
    const hasAdcPath = Boolean(env.GOOGLE_APPLICATION_CREDENTIALS && env.GOOGLE_APPLICATION_CREDENTIALS.trim().length > 0);
    const hasCloudRunIdentity = Boolean(
      (env.K_SERVICE || env.CLOUD_RUN_JOB || env.PORT) &&
      (env.FIREBASE_PROJECT_ID || activeProjectId)
    );

    // If no valid service account JSON, no ADC path, and no Cloud Run platform identity
    if (!parsedServiceAccount && !hasAdcPath && !hasCloudRunIdentity) {
      const detail = rawServiceAccount
        ? `Malformed FIREBASE_SERVICE_ACCOUNT: "${rawServiceAccount.slice(0, 30)}" is not valid service account JSON.`
        : 'Missing FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.';
      const fatalMsg =
        `FATAL_CONFIG_ERROR: Running in NODE_ENV=production without Firebase Admin credentials (${detail}). Silent fallback to in-memory persistence is strictly forbidden in production.`;
      serverLogger.fatal('PRODUCTION_FATAL_CONFIG', fatalMsg);
      if (options.exitOnFatal) {
        process.exit(1);
      }
      throw new FatalError(fatalMsg);
    }

    // When raw string was provided but was not valid JSON, and Cloud Run ADC is available:
    if (rawServiceAccount && !parsedServiceAccount && (hasCloudRunIdentity || hasAdcPath)) {
      serverLogger.warn(
        'FIREBASE_CONFIG_WARN',
        `FIREBASE_SERVICE_ACCOUNT does not contain valid service account JSON (received: "${rawServiceAccount.slice(0, 30)}..."). Safely falling back to Cloud Run Application Default Credentials (project: ${activeProjectId}).`
      );
    }
  }
}

validateEnvironment(process.env, {
  exitOnFatal: !process.env.VITEST && process.env.NODE_ENV !== 'test'
});

// Initialize Firebase Admin SDK
try {
  if (getApps().length === 0) {
    const serviceAccount = parseServiceAccountCredentials(process.env.FIREBASE_SERVICE_ACCOUNT);

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || activeProjectId
      });
      serverLogger.info('FIREBASE_INIT', 'Firebase Admin initialized with service account.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        projectId: activeProjectId || 'demo-project'
      });
      serverLogger.info('FIREBASE_INIT', 'Firebase Admin initialized with explicit application default credentials.');
    } else if ((process.env.NODE_ENV === 'production' || process.env.K_SERVICE || process.env.CLOUD_RUN_JOB) && activeProjectId) {
      initializeApp({
        projectId: activeProjectId
      });
      serverLogger.info('FIREBASE_INIT', `Firebase Admin initialized with implicit application default credentials (Cloud Run: ${activeProjectId}).`);
    } else if (!process.env.VITEST && process.env.NODE_ENV !== 'test' && activeProjectId) {
      initializeApp({
        projectId: activeProjectId
      });
      serverLogger.info('FIREBASE_DEV', `Firebase Admin initialized with projectId (${activeProjectId}) for ID token verification. Persistence utilizing memory adapter.`);
    } else {
      serverLogger.warn('FIREBASE_DEV', 'Running in non-production mode without Firebase credentials. Utilizing memory adapter.');
    }
  }
} catch (error) {
  serverLogger.error('FIREBASE_INIT_ERROR', 'Firebase Admin initialization failed:', error);
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.VITEST) {
      process.exit(1);
    }
    throw new FatalError(`Firebase Admin initialization failed in production: ${error instanceof Error ? error.message : String(error)}`);
  }
}

export async function createExpressApp() {
  const app = express();

  // Request correlation tracking
  app.use(requestCorrelationMiddleware);

  // Hardened HTTP & CSP security headers
  app.use(securityHeadersMiddleware);

  // Body parsing with strict size limits
  app.use(express.json({ limit: '512kb' }));
  app.use(express.urlencoded({ extended: true, limit: '512kb' }));

  // Deep payload sanitization (anti-prototype pollution, NoSQL operator block, XSS strip)
  app.use(sanitizePayloadMiddleware);

  // Mount API router
  app.use('/api', apiRouter);

  // Centralized Error Handler with standardized contract
  app.use((err: unknown, req: Request, res: Response, _next: NextFunction) => {
    serverLogger.error('UNCAUGHT_SERVER_ERROR', 'Uncaught exception during request processing', err, {
      path: req.originalUrl,
      method: req.method
    }, req.user?.uid, req.ip, req.id);

    handleServerException(err, req, res);
  });

  return app;
}

async function startServer() {
  // Validate production environment and fail-fast before server boot or listening
  validateEnvironment(process.env, {
    exitOnFatal: !process.env.VITEST && process.env.NODE_ENV !== 'test'
  });

  const app = await createExpressApp();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true, hmr: false },
      appType: "spa",
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    // React Router SPA fallback
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  app.listen(PORT, "0.0.0.0", () => {
    serverLogger.info('SERVER_START', `ZiGame ${APP_VERSION} Hardened Production Server running on port ${PORT}`);
  });
}

// Only start dev/prod server when run directly as main entry (not in vitest runner)
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startServer();
}
