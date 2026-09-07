/**
 * Distributed & Authoritative Rate Limiter
 * ZiGame 2.0 Stabilization & Production Hardening
 */

import { Request, Response, NextFunction } from 'express';
import { getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { serverLogger } from './logger';
import { sendApiError } from './requestContext';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetTime: number;
}

export interface RateLimiter {
  check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult>;
}

/**
 * In-Memory Sliding Window Counter Rate Limiter
 * Used during testing and when Firestore is uninitialized
 */
export class MemoryRateLimiter implements RateLimiter {
  private store = new Map<string, { count: number; resetTime: number }>();

  async check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    const now = Date.now();
    const entry = this.store.get(key);

    if (!entry || now > entry.resetTime) {
      const resetTime = now + windowMs;
      this.store.set(key, { count: 1, resetTime });
      return { allowed: true, remaining: maxRequests - 1, resetTime };
    }

    if (entry.count >= maxRequests) {
      return { allowed: false, remaining: 0, resetTime: entry.resetTime };
    }

    entry.count += 1;
    return { allowed: true, remaining: maxRequests - entry.count, resetTime: entry.resetTime };
  }

  clear() {
    this.store.clear();
  }
}

/**
 * Firestore-backed Rate Limiter for Production Environments
 */
export class FirestoreRateLimiter implements RateLimiter {
  private fallback = new MemoryRateLimiter();

  async check(key: string, maxRequests: number, windowMs: number): Promise<RateLimitResult> {
    if (getApps().length === 0 || process.env.NODE_ENV === 'test') {
      return this.fallback.check(key, maxRequests, windowMs);
    }

    try {
      const db = getFirestore();
      const sanitizedKey = key.replace(/[^a-zA-Z0-9_-]/g, '_').slice(0, 128);
      const docRef = db.collection('rateLimits').doc(sanitizedKey);

      return await db.runTransaction(async (tx) => {
        const now = Date.now();
        const doc = await tx.get(docRef);

        if (!doc.exists) {
          const resetTime = now + windowMs;
          tx.set(docRef, { count: 1, resetTime, updatedAt: now });
          return { allowed: true, remaining: maxRequests - 1, resetTime };
        }

        const data = doc.data() as { count: number; resetTime: number };
        if (now > data.resetTime) {
          const resetTime = now + windowMs;
          tx.set(docRef, { count: 1, resetTime, updatedAt: now });
          return { allowed: true, remaining: maxRequests - 1, resetTime };
        }

        if (data.count >= maxRequests) {
          return { allowed: false, remaining: 0, resetTime: data.resetTime };
        }

        const newCount = data.count + 1;
        tx.update(docRef, { count: newCount, updatedAt: now });
        return { allowed: true, remaining: maxRequests - newCount, resetTime: data.resetTime };
      });
    } catch (err) {
      serverLogger.warn('RATE_LIMITER_FALLBACK', 'Firestore rate limiter failed, falling back to memory', { error: String(err) });
      return this.fallback.check(key, maxRequests, windowMs);
    }
  }
}

export const defaultRateLimiter: RateLimiter = new FirestoreRateLimiter();

export const SENSITIVE_CATEGORIES = new Set([
  'economy',
  'economy_fetch',
  'reward_claim',
  'gamble',
  'gacha',
  'shop_purchase',
  'score_submit',
  'daily_spin',
  'session_start',
  'admin'
]);

/**
 * Express middleware generator for rate limiting
 */
export function rateLimit(
  maxRequests: number,
  windowMs: number = 60000,
  category?: string,
  limiter: RateLimiter = defaultRateLimiter
) {
  const fallbackMemLimiter = new MemoryRateLimiter();

  return async (req: Request, res: Response, next: NextFunction) => {
    // In test environment, skip rate limiting unless explicitly testing it
    if (process.env.NODE_ENV === 'test' && !req.headers['x-test-rate-limit']) {
      return next();
    }

    const identifier = req.user?.uid ? `usr_${req.user.uid}` : `ip_${req.ip || 'unknown'}`;
    const endpointCat = category || req.baseUrl + req.path;
    const key = `rl_${endpointCat}_${identifier}`;
    const isSensitive = category ? SENSITIVE_CATEGORIES.has(category) : false;

    try {
      let result: RateLimitResult;
      try {
        result = await limiter.check(key, maxRequests, windowMs);
      } catch (limiterErr) {
        // Secure degraded: fallback to in-memory limiter
        serverLogger.warn('RATE_LIMIT_DEGRADED', 'Primary rate limiter failed, applying in-memory fallback', {
          category: endpointCat,
          error: String(limiterErr)
        });
        result = await fallbackMemLimiter.check(key, maxRequests, windowMs);
      }

      res.setHeader('X-RateLimit-Limit', maxRequests.toString());
      res.setHeader('X-RateLimit-Remaining', Math.max(0, result.remaining).toString());
      res.setHeader('X-RateLimit-Reset', Math.ceil(result.resetTime / 1000).toString());

      if (!result.allowed) {
        serverLogger.security('RATE_LIMIT', `Rate limit exceeded on ${endpointCat}`, {
          maxRequests,
          windowMs,
          identifier
        }, req.user?.uid, req.ip, req.id);

        return sendApiError(
          res,
          429,
          'RATE_LIMIT_EXCEEDED',
          'Terlalu banyak permintaan dalam waktu singkat. Silakan tunggu beberapa saat.',
          { retryAfterSeconds: Math.max(1, Math.ceil((result.resetTime - Date.now()) / 1000)) }
        );
      }

      next();
    } catch (err) {
      serverLogger.error('RATE_LIMIT_ERROR', 'Failed to evaluate rate limit', err, undefined, req.user?.uid, req.ip, req.id);
      if (isSensitive) {
        // Fail-closed for sensitive economy/admin/score endpoints
        return sendApiError(
          res,
          503,
          'SERVICE_UNAVAILABLE',
          'Layanan verifikasi keamanan sedang mengalami degradasi. Silakan coba kembali sesaat lagi.'
        );
      }
      next();
    }
  };
}
