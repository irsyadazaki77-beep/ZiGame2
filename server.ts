import express, { Request, Response, NextFunction } from "express";
import send from "send";
import path from "path";

// Defend against hoisted mime v2+ breaking express mime.charsets.lookup
if ((send as any).mime && !(send as any).mime.charsets) {
  (send as any).mime.charsets = {
    lookup: (type: string) => {
      if (!type) return undefined;
      const cleanType = type.split(';')[0].trim().toLowerCase();
      if (/^text\/|^application\/(javascript|json)/.test(cleanType)) {
        return 'UTF-8';
      }
      return undefined;
    }
  };
}
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { apiRouter } from "./src/server/apiRouter";
import { serverLogger } from "./src/server/logger";
import { requestCorrelationMiddleware, handleServerException } from "./src/server/requestContext";
import { APP_VERSION } from "./src/config/version";
import firebaseAppletConfig from "./firebase-applet-config.json";

// Validate production environment on boot
export function validateEnvironment() {
  if (process.env.NODE_ENV === 'production') {
    if (!process.env.FIREBASE_SERVICE_ACCOUNT && !process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      serverLogger.warn(
        'PRODUCTION_CONFIG_WARN',
        'FIREBASE_SERVICE_ACCOUNT or GOOGLE_APPLICATION_CREDENTIALS not configured. Persistence will operate in fallback mode unless configured.'
      );
    }
  }
}

validateEnvironment();

// Initialize Firebase Admin SDK
try {
  if (getApps().length === 0) {
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const serviceAccount = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || firebaseAppletConfig.projectId
      });
      serverLogger.info('FIREBASE_INIT', 'Firebase Admin initialized with service account.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp({
        projectId: firebaseAppletConfig.projectId
      });
      serverLogger.info('FIREBASE_INIT', 'Firebase Admin initialized with explicit application default credentials.');
    } else if (process.env.NODE_ENV === 'production') {
      initializeApp({
        projectId: firebaseAppletConfig.projectId
      });
      serverLogger.info('FIREBASE_INIT', 'Firebase Admin initialized with implicit application default credentials (Cloud Run).');
    } else if (!process.env.VITEST && process.env.NODE_ENV !== 'test' && firebaseAppletConfig.projectId) {
      initializeApp({
        projectId: firebaseAppletConfig.projectId
      });
      serverLogger.info('FIREBASE_DEV', `Firebase Admin initialized with projectId (${firebaseAppletConfig.projectId}) for ID token verification. Persistence utilizing memory adapter.`);
    } else {
      serverLogger.warn('FIREBASE_DEV', 'Running in non-production mode without Firebase credentials. Utilizing memory adapter.');
    }
  }
} catch (error) {
  serverLogger.error('FIREBASE_INIT_ERROR', 'Firebase Admin initialization failed:', error);
}

export async function createExpressApp() {
  const app = express();

  // Request correlation tracking
  app.use(requestCorrelationMiddleware);

  // Security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
    res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=()');
    if (process.env.NODE_ENV === 'production') {
      res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
    }
    next();
  });

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

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
