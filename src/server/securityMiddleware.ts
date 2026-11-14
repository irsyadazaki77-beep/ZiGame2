import { Request, Response, NextFunction } from 'express';
import { sendApiError, handleServerException } from './requestContext';
import { ApiError } from './errors';
import { serverLogger } from './logger';
import { checkUserBanStatus, recordSecurityEvent } from './persistence/security';

const FORBIDDEN_KEYS = new Set(['__proto__', 'constructor', 'prototype']);
const MAX_OBJECT_DEPTH = 10;

/**
 * Strips dangerous HTML/script tags and inline event handlers from string inputs
 * to prevent stored XSS in leaderboards, shoutboxes, or profile fields.
 */
export function sanitizeStringInput(input: string, maxLength = 2048): string {
  const trimmed = input.slice(0, maxLength);
  return trimmed
    .replace(/<\s*script[^>]*>[\s\S]*?<\s*\/\s*script\s*>/gi, '')
    .replace(/<\s*\/?\s*(script|iframe|object|embed|svg|meta|link|style)[^>]*>/gi, '')
    .replace(/javascript\s*:/gi, '')
    .replace(/vbscript\s*:/gi, '')
    .replace(/on[a-z]+\s*=/gi, '');
}

/**
 * Inspects and sanitizes an object recursively.
 * Returns { valid: false, reason } if prototype pollution or NoSQL operator injection is detected.
 */
function inspectAndSanitizeObject(
  value: unknown,
  depth = 0
): { valid: boolean; sanitized?: unknown; reason?: string } {
  if (depth > MAX_OBJECT_DEPTH) {
    return { valid: false, reason: 'JSON payload nesting depth exceeded security limit' };
  }

  if (value === null || value === undefined) {
    return { valid: true, sanitized: value };
  }

  if (typeof value === 'string') {
    return { valid: true, sanitized: sanitizeStringInput(value) };
  }

  if (typeof value !== 'object') {
    return { valid: true, sanitized: value };
  }

  if (Array.isArray(value)) {
    if (value.length > 500) {
      return { valid: false, reason: 'Array payload length exceeded security limit' };
    }
    const sanitizedArr: unknown[] = [];
    for (const item of value) {
      const res = inspectAndSanitizeObject(item, depth + 1);
      if (!res.valid) return res;
      sanitizedArr.push(res.sanitized);
    }
    return { valid: true, sanitized: sanitizedArr };
  }

  // Check for literal __proto__ in own property names
  const ownKeys = Object.getOwnPropertyNames(value);
  const sanitizedObj: Record<string, unknown> = {};

  for (const key of ownKeys) {
    if (FORBIDDEN_KEYS.has(key) || key.startsWith('$')) {
      return {
        valid: false,
        reason: `Forbidden or injection key detected in payload: ${key}`
      };
    }

    const propVal = (value as Record<string, unknown>)[key];
    const res = inspectAndSanitizeObject(propVal, depth + 1);
    if (!res.valid) return res;
    sanitizedObj[key] = res.sanitized;
  }

  return { valid: true, sanitized: sanitizedObj };
}

/**
 * Express middleware: Enforces strict HTTP security headers (CSP, COOP, HSTS, Nosniff, Frame Options).
 */
export function securityHeadersMiddleware(_req: Request, res: Response, next: NextFunction) {
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'SAMEORIGIN');
  res.setHeader('X-XSS-Protection', '1; mode=block');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  res.setHeader('Permissions-Policy', 'camera=(), microphone=(), geolocation=(), payment=()');
  res.setHeader('Cross-Origin-Opener-Policy', 'same-origin-allow-popups');
  res.setHeader(
    'Content-Security-Policy',
    "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval' blob: https://apis.google.com https://*.firebaseapp.com; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com data:; img-src 'self' data: blob: https:; worker-src 'self' blob:; connect-src 'self' https: wss: data: blob:; frame-ancestors 'self' https://*.google.com https://*.run.app;"
  );
  if (process.env.NODE_ENV === 'production') {
    res.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
  }
  next();
}

/**
 * Express middleware: Deep payload sanitizer against prototype pollution, NoSQL injection, and stored XSS.
 */
export function sanitizePayloadMiddleware(req: Request, res: Response, next: NextFunction) {
  if (req.body && typeof req.body === 'object') {
    const bodyCheck = inspectAndSanitizeObject(req.body);
    if (!bodyCheck.valid) {
      serverLogger.security('MALICIOUS_PAYLOAD', bodyCheck.reason || 'Malicious payload blocked', {
        path: req.originalUrl,
        method: req.method
      }, req.user?.uid, req.ip, req.id);

      recordSecurityEvent({
        userId: req.user?.uid,
        clientIp: req.ip,
        eventType: 'MALICIOUS_PAYLOAD_BLOCKED',
        severity: 'HIGH',
        reason: bodyCheck.reason || 'Malicious payload blocked',
        path: req.originalUrl
      }).catch(() => {});

      return sendApiError(res, 400, 'SECURITY_VIOLATION', 'Payload permintaan mengandung struktur atau karakter yang dilarang.');
    }
    req.body = bodyCheck.sanitized;
  }

  if (req.query && typeof req.query === 'object') {
    const queryCheck = inspectAndSanitizeObject(req.query);
    if (!queryCheck.valid) {
      return sendApiError(res, 400, 'SECURITY_VIOLATION', 'Parameter query tidak valid.');
    }
  }

  next();
}

/**
 * Express middleware: Blocks suspended/banned accounts from executing game sessions, score submissions, or economy mutations.
 */
export async function requireNotBanned(req: Request, res: Response, next: NextFunction) {
  if (!req.user || !req.user.uid) {
    return next();
  }

  try {
    const status = await checkUserBanStatus(req.user.uid);
    if (status.isBanned) {
      serverLogger.security('SUSPENDED_ACCOUNT_BLOCKED', `Suspended user ${req.user.uid} attempted access to ${req.originalUrl}`, {
        banReason: status.banReason,
        strikeCount: status.strikeCount
      }, req.user.uid, req.ip, req.id);

      return sendApiError(
        res,
        403,
        'ACCOUNT_SUSPENDED',
        `Akun Anda sedang dibekukan karena pelanggaran keamanan: ${status.banReason || 'Terdeteksi aktivitas mencurigakan.'}`,
        {
          banReason: status.banReason,
          bannedAt: status.bannedAt,
          banExpiresAt: status.banExpiresAt,
          strikeCount: status.strikeCount
        }
      );
    }
  } catch (err) {
    if (err instanceof ApiError && err.status === 503) {
      return handleServerException(err, req, res);
    }
    serverLogger.warn('BAN_CHECK_WARN', 'Failed to check user ban status', { error: String(err) });
  }

  next();
}
