import { Request, Response, NextFunction } from 'express';
import { getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';
import { serverLogger } from './logger';
import { sendApiError } from './requestContext';

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

// Optional emergency UID allowlist only (no default hardcoded email or UID)
const ADMIN_UIDS = (process.env.ADMIN_UIDS || '')
  .split(',')
  .map(u => u.trim())
  .filter(Boolean);

/**
 * Checks if a user has admin privilege based strictly on Firebase Custom Claims,
 * with optional emergency ADMIN_UIDS allowlist.
 * NO hardcoded emails or default privileged accounts.
 */
export function isUserAdmin(uid: string, _email?: string, claims?: Record<string, any>): boolean {
  if (claims?.admin === true || claims?.role === 'admin') return true;
  if (uid && ADMIN_UIDS.length > 0 && ADMIN_UIDS.includes(uid)) return true;
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
  const isTestEnv = process.env.NODE_ENV === 'test' || Boolean(process.env.VITEST);

  if (!token) {
    // Test bypass is STRICTLY restricted to test environment
    if (isTestEnv) {
      const testUid = req.headers['x-test-uid'];
      if (typeof testUid === 'string' && testUid.trim()) {
        const uid = testUid.trim();
        const testEmail = typeof req.headers['x-test-email'] === 'string' ? req.headers['x-test-email'] : undefined;
        const testIsAdmin = req.headers['x-test-admin'] === 'true' || isUserAdmin(uid, testEmail);
        req.user = {
          uid,
          email: testEmail,
          name: typeof req.headers['x-test-name'] === 'string' ? req.headers['x-test-name'] : 'Test User',
          isAdmin: testIsAdmin,
          tokenClaims: { admin: testIsAdmin }
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
      // Firebase Admin uninitialized
      if (isTestEnv) {
        req.user = {
          uid: token.startsWith('mock_') ? token.replace('mock_', '') : 'test_user',
          isAdmin: token.includes('admin')
        };
        return next();
      }

      serverLogger.security('FIREBASE_FAILURE', 'Firebase Admin unavailable for token verification', undefined, undefined, req.ip, req.id);
      return sendApiError(res, 503, 'SERVICE_UNAVAILABLE', 'Layanan autentikasi backend tidak tersedia.');
    }
  } catch (err: any) {
    serverLogger.security('AUTH_FAILURE', 'Failed to verify Firebase ID token', {
      errorName: err?.name,
      errorCode: err?.code,
      message: err?.message
    }, undefined, req.ip, req.id);

    if (err?.code === 'auth/id-token-expired') {
      return sendApiError(res, 401, 'TOKEN_EXPIRED', 'Token sesi telah kadaluarsa. Silakan muat ulang atau login kembali.');
    }

    return sendApiError(res, 401, 'INVALID_TOKEN', 'Token otentikasi tidak valid.');
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
    }, undefined, req.ip, req.id);

    return sendApiError(res, 401, 'UNAUTHORIZED', 'Akses ditolak. Silakan login terlebih dahulu.');
  }
  next();
}

/**
 * Middleware: Requires a verified admin role
 */
export function requireAdmin(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.uid) {
    return sendApiError(res, 401, 'UNAUTHORIZED', 'Akses ditolak. Silakan login sebagai administrator.');
  }

  if (!req.user.isAdmin) {
    serverLogger.security('ADMIN_ACTION', 'Non-admin user attempted admin endpoint', {
      path: req.originalUrl,
      method: req.method
    }, req.user.uid, req.ip, req.id);

    return sendApiError(res, 403, 'FORBIDDEN', 'Akses ditolak. Memerlukan hak akses administrator server.');
  }

  next();
}
