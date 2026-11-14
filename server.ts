import express, { Request, Response, NextFunction } from "express";
import { createServer as createViteServer } from "vite";
import path from "path";
import fs from "fs";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { apiRouter } from "./src/server/apiRouter";
import { serverLogger } from "./src/server/logger";
import { requestCorrelationMiddleware, handleServerException } from "./src/server/requestContext";
import { securityHeadersMiddleware, sanitizePayloadMiddleware } from "./src/server/securityMiddleware";
import {
  probeFirestoreAvailability,
  isFirestoreAvailable,
  hasValidAdcFile,
  sanitizeInvalidAdcEnv
} from "./src/server/persistence/db";
import { APP_VERSION } from "./src/config/version";
import { FatalError } from "./src/server/errors";

export { FatalError };

interface LocalAppletConfig {
  projectId?: string;
  firestoreDatabaseId?: string;
}

function readLocalAppletConfig(): LocalAppletConfig {
  const configPath = path.resolve(process.cwd(), "firebase-applet-config.json");
  if (!fs.existsSync(configPath)) return {};
  try {
    const parsed = JSON.parse(fs.readFileSync(configPath, "utf-8"));
    if (parsed?.projectId && String(parsed.projectId).includes("YOUR_FIREBASE_PROJECT_ID")) {
      return {};
    }
    return parsed || {};
  } catch {
    return {};
  }
}

const localAppletConfig = readLocalAppletConfig();
const activeProjectId = process.env.FIREBASE_PROJECT_ID || localAppletConfig.projectId;

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
    const rawAdcPath = env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    const hasAdcPath = hasValidAdcFile(rawAdcPath);
    const hasCloudRunIdentity = Boolean(
      (env.K_SERVICE || env.CLOUD_RUN_JOB || env.PORT) &&
      (env.FIREBASE_PROJECT_ID || activeProjectId)
    );

    if (!parsedServiceAccount && !hasAdcPath && !hasCloudRunIdentity) {
      const detailParts: string[] = [];
      if (rawServiceAccount) {
        detailParts.push(`Malformed FIREBASE_SERVICE_ACCOUNT: "${rawServiceAccount.slice(0, 30)}" is not valid service account JSON.`);
      }
      if (rawAdcPath) {
        detailParts.push(`Invalid GOOGLE_APPLICATION_CREDENTIALS: "${rawAdcPath.slice(0, 30)}" does not point to a valid JSON credential file.`);
      }
      const detail = detailParts.length > 0
        ? detailParts.join(' ')
        : 'Missing FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS.';
      const fatalMsg =
        `FATAL_CONFIG_ERROR: Running in NODE_ENV=production without Firebase Admin credentials (${detail}). Silent fallback to in-memory persistence is strictly forbidden in production.`;
      serverLogger.fatal('PRODUCTION_FATAL_CONFIG', fatalMsg);
      if (options.exitOnFatal) {
        process.exit(1);
      }
      throw new FatalError(fatalMsg);
    }

    if (rawServiceAccount && !parsedServiceAccount && (hasCloudRunIdentity || hasAdcPath)) {
      serverLogger.warn(
        'FIREBASE_CONFIG_WARN',
        `FIREBASE_SERVICE_ACCOUNT does not contain valid service account JSON (received: "${rawServiceAccount.slice(0, 30)}..."). Safely falling back to Cloud Run Application Default Credentials (project: ${activeProjectId}).`
      );
    }

    if (rawAdcPath && !hasAdcPath && (hasCloudRunIdentity || parsedServiceAccount)) {
      serverLogger.warn(
        'FIREBASE_CONFIG_WARN',
        `GOOGLE_APPLICATION_CREDENTIALS does not point to a valid credential JSON file (received: "${rawAdcPath.slice(0, 30)}"). Ignoring invalid path so Cloud Run Application Default Credentials or service account can be used cleanly.`
      );
    }
  }
}

let prodEnvConfigError: string | null = null;
try {
  validateEnvironment(process.env, {
    exitOnFatal: false
  });
} catch (err) {
  prodEnvConfigError = err instanceof Error ? err.message : String(err);
  serverLogger.fatal(
    'PRODUCTION_CONFIG_DEGRADED',
    'Production server booting without full Firebase Admin credentials; all server persistence routes will return 503 Service Unavailable (no memoryStore fallback).',
    err
  );
}

// Initialize Firebase Admin SDK
try {
  if (getApps().length === 0) {
    const serviceAccount = parseServiceAccountCredentials(process.env.FIREBASE_SERVICE_ACCOUNT);
    const isTestRuntime = Boolean(process.env.VITEST || process.env.NODE_ENV === 'test');
    const removedInvalidGac = !isTestRuntime ? sanitizeInvalidAdcEnv(process.env) : null;

    if (removedInvalidGac !== null) {
      serverLogger.warn(
        'FIREBASE_CONFIG_WARN',
        `GOOGLE_APPLICATION_CREDENTIALS ("${removedInvalidGac.slice(0, 30)}") does not exist or is not valid JSON; ignoring invalid path so Application Default Credentials can fall back safely.`
      );
    }

    const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    const hasValidGacFile = hasValidAdcFile(gacPath);

    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || activeProjectId
      });
      serverLogger.info('FIREBASE_INIT', 'Firebase Admin initialized with service account.');
    } else if (hasValidGacFile) {
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
      serverLogger.warn('FIREBASE_DEV', `Firebase Admin initialized with projectId (${activeProjectId}) for ID token verification. Ephemeral memoryStore active in development unless Firestore credentials are supplied.`);
    } else if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
      serverLogger.warn('FIREBASE_DEV', 'Running in development mode without Firebase credentials. Utilizing ephemeral memoryStore.');
    }
  }
} catch (error) {
  serverLogger.error('FIREBASE_INIT_ERROR', 'Firebase Admin initialization failed:', error);
  if (process.env.NODE_ENV === 'production') {
    serverLogger.fatal(
      'PRODUCTION_FIREBASE_INIT_DEGRADED',
      'Firebase Admin failed to initialize in production; server will boot without database access and return 503 on persistence endpoints.',
      error
    );
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
  // Prevent third-party gRPC/Firestore SDK background promise rejections from crashing the
  // production HTTP server process when operating in degraded or transient network conditions.
  process.on('unhandledRejection', (reason: unknown) => {
    serverLogger.error('UNHANDLED_PROMISE_REJECTION', 'Unhandled promise rejection captured in server runtime', reason);
  });

  // Verify Firestore connectivity at startup:
  // - In production: never fall back to memoryStore; if Firestore is unconfigured or unreachable,
  //   keep HTTP server alive so Cloud Run health/SPA/Offline Guest Mode serve cleanly while all
  //   state-mutating & DB endpoints fail closed with 503 Service Unavailable.
  // - In development: probe so missing/unprivileged credentials fall back explicitly with warning.
  const firestoreOk = prodEnvConfigError ? false : await probeFirestoreAvailability(3000);
  if (process.env.NODE_ENV === 'production' && (!firestoreOk || !isFirestoreAvailable())) {
    serverLogger.fatal(
      'PRODUCTION_DEGRADED_MODE',
      'Firestore unavailable at production startup. Serving SPA and health endpoints while rejecting all persistence mutations with 503 Service Unavailable (memoryStore fallback is disabled).'
    );
  }

  const app = await createExpressApp();
  const PORT = Number(process.env.PORT) || 3000;

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
  startServer().catch((err) => {
    serverLogger.fatal('SERVER_BOOT_FAILURE', 'Fatal error while starting Express server', err);
    process.exit(1);
  });
}
