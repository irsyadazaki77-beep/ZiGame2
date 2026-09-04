import { Request, Response, NextFunction } from 'express';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { serverLogger } from './logger';

export interface AuthenticatedUser {
  uid: string;
  email?: string;
  name?: string;
  picture?: string;
  isAdmin: boolean;
  tokenClaims?: Record<string, any>;
}

// Extend Express Request interface
declare global {
  namespace Express {
    interface Request {
      user?: AuthenticatedUser;
    }
  }
}

// Known admin emails / UIDs from environment or defaults
const ADMIN_EMAILS = (process.env.ADMIN_EMAILS || 'admin@zigame.io,owner@zigame.io')
  .split(',')
  .map(e => e.trim().toLowerCase())
  .filter(Boolean);

const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean);

/**
 * Checks if a user has admin privilege based on claims, emails, or configured UIDs
 */
export function isUserAdmin(uid: string, email?: string, claims?: Record<string, any>): boolean {
  if (claims?.admin === true || claims?.role === 'admin') return true;
  if (email && ADMIN_EMAILS.includes(email.toLowerCase())) return true;
  if (uid && ADMIN_UIDS.includes(uid)) return true;
  return false;
}

/**
 * Extracts Bearer token from Authorization header
 */
export function extractBearerToken(req: Request): string | null {
  const authHeader = req.headers.authorization;
  if (!authHeader || typeof authHeader !== 'string') return null;

  const parts = authHeader.split(' ');
  if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
    return parts[1].trim();
  }
  return null;
}

/**
 * Middleware: Verifies Firebase ID Token if present, populates req.user.
 * Does NOT reject if token is absent; use `requireAuth` for mandatory auth.
 */
export async function authenticateToken(req: Request, res: Response, next: NextFunction) {
  const token = extractBearerToken(req);

  if (!token) {
    // Non-production test bypass support (e.g. for vitest)
    if (process.env.NODE_ENV !== 'production') {
      const testUid = req.headers['x-test-uid'];
      if (typeof testUid === 'string' && testUid) {
        const testEmail = typeof req.headers['x-test-email'] === 'string' ? req.headers['x-test-email'] : undefined;
        const testIsAdmin = req.headers['x-test-admin'] === 'true' || isUserAdmin(testUid, testEmail);
        req.user = {
          uid: testUid,
          email: testEmail,
          name: typeof req.headers['x-test-name'] === 'string' ? req.headers['x-test-name'] : 'Test User',
          isAdmin: testIsAdmin
        };
        return next();
      }
    }
    return next();
  }

  try {
    if (getApps().length > 0) {
      const decoded = await getAuth().verifyIdToken(token);
      req.user = {
        uid: decoded.uid,
        email: decoded.email,
        name: decoded.name || decoded.displayName,
        picture: decoded.picture,
        isAdmin: isUserAdmin(decoded.uid, decoded.email, decoded),
        tokenClaims: decoded
      };
      return next();
    } else {
      // In development when Firebase Admin isn't initialized
      if (process.env.NODE_ENV !== 'production') {
        serverLogger.warn('AUTH_DEV_MODE', 'Firebase Admin not initialized, parsing token fallback in dev mode');
        // Accept mock dev token
        req.user = {
          uid: token.startsWith('mock_') ? token.replace('mock_', '') : 'dev_user',
          isAdmin: token.includes('admin')
        };
        return next();
      } else {
        serverLogger.security('FIREBASE_FAILURE', 'Firebase Admin unavailable in production');
        return res.status(503).json({
          success: false,
          code: 'SERVICE_UNAVAILABLE',
          message: 'Layanan autentikasi backend tidak tersedia.'
        });
      }
    }
  } catch (err: any) {
    serverLogger.security('AUTH_FAILURE', 'Failed to verify Firebase ID token', {
      errorName: err?.name,
      errorCode: err?.code,
      message: err?.message
    }, undefined, req.ip);

    if (err?.code === 'auth/id-token-expired') {
      return res.status(401).json({
        success: false,
        code: 'TOKEN_EXPIRED',
        message: 'Token sesi telah kadaluarsa. Silakan muat ulang atau login kembali.'
      });
    }

    return res.status(401).json({
      success: false,
      code: 'INVALID_TOKEN',
      message: 'Token otentikasi tidak valid.'
    });
  }
}

/**
 * Middleware: Requires a verified authenticated user
 */
export function requireAuth(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.uid) {
    serverLogger.security('AUTH_FAILURE', 'Unauthenticated request to protected endpoint', {
      path: req.originalUrl,
      method: req.method
    }, undefined, req.ip);

    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Akses ditolak. Silakan login terlebih dahulu.'
    });
  }
  next();
}

/**
 * Middleware: Requires a verified admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.uid) {
    return res.status(401).json({
      success: false,
      code: 'UNAUTHORIZED',
      message: 'Akses ditolak. Silakan login sebagai administrator.'
    });
  }

  if (!req.user.isAdmin) {
    serverLogger.security('ADMIN_ACTION', 'Non-admin user attempted admin endpoint', {
      path: req.originalUrl,
      method: req.method
    }, req.user.uid, req.ip);

    return res.status(403).json({
      success: false,
      code: 'FORBIDDEN',
      message: 'Akses ditolak. Memerlukan hak akses administrator server.'
    });
  }

  next();
}
