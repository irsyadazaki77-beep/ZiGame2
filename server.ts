import express, { Request, Response, NextFunction } from "express";
import path from "path";
import { createServer as createViteServer } from "vite";
import { initializeApp, cert, getApps } from "firebase-admin/app";
import { apiRouter } from "./src/server/apiRouter";
import { serverLogger } from "./src/server/logger";
import { requestCorrelationMiddleware } from "./src/server/requestContext";

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
        credential: cert(serviceAccount)
      });
      serverLogger.info('FIREBASE_INIT', 'Firebase Admin initialized with service account.');
    } else if (process.env.GOOGLE_APPLICATION_CREDENTIALS) {
      initializeApp();
      serverLogger.info('FIREBASE_INIT', 'Firebase Admin initialized with application default credentials.');
    } else {
      if (process.env.NODE_ENV === 'production') {
        serverLogger.warn('FIREBASE_INIT', 'Running without Firebase credentials in production environment.');
      } else {
        serverLogger.warn('FIREBASE_DEV', 'Running in non-production mode without Firebase credentials. Utilizing memory adapter.');
      }
    }
  }
} catch (error) {
  serverLogger.error('FIREBASE_INIT_ERROR', 'Firebase Admin initialization failed:', error);
}

export async function createExpressApp() {
  const app = express();

  // Request correlation tracking
  app.use(requestCorrelationMiddleware);

  // Basic security headers
  app.use((_req: Request, res: Response, next: NextFunction) => {
    res.setHeader('X-Content-Type-Options', 'nosniff');
    res.setHeader('X-Frame-Options', 'SAMEORIGIN');
    res.setHeader('X-XSS-Protection', '1; mode=block');
    next();
  });

  // Body parsing
  app.use(express.json({ limit: '1mb' }));
  app.use(express.urlencoded({ extended: true, limit: '1mb' }));

  // Mount API router
  app.use('/api', apiRouter);

  // Centralized Error Handler with standardized contract
  app.use((err: any, req: Request, res: Response, _next: NextFunction) => {
    serverLogger.error('UNCAUGHT_SERVER_ERROR', 'Uncaught exception during request processing', err, {
      path: req.originalUrl,
      method: req.method
    }, req.user?.uid, req.ip, req.id);

    const status = err?.status || err?.statusCode || (err?.code === 'SERVICE_UNAVAILABLE' ? 503 : (err?.code === 'INSUFFICIENT_FUNDS' ? 400 : 500));
    res.status(status).json({
      success: false,
      code: err?.code || 'INTERNAL_SERVER_ERROR',
      message: process.env.NODE_ENV === 'production'
        ? 'Terjadi kendala pada server. Tim kami telah mencatat insiden ini.'
        : err?.message || 'Internal Server Error',
      requestId: req.id
    });
  });

  return app;
}

async function startServer() {
  const app = await createExpressApp();
  const PORT = 3000;

  // Vite middleware for development
  if (process.env.NODE_ENV !== "production") {
    const vite = await createViteServer({
      server: { middlewareMode: true },
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
    serverLogger.info('SERVER_START', `ZiGame 2.0 Hardened Production Server running on port ${PORT}`);
  });
}

// Only start dev/prod server when run directly as main entry (not in vitest runner)
if (!process.env.VITEST && process.env.NODE_ENV !== 'test') {
  startServer();
}
