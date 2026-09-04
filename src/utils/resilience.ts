import { logger } from './logger';

export type AppErrorCode =
  | 'NETWORK_ERROR'
  | 'AUTH_EXPIRED'
  | 'API_TIMEOUT'
  | 'CLOUD_SYNC_FAILED'
  | 'CLOUD_CONFLICT'
  | 'FIREBASE_UNAVAILABLE'
  | 'GAME_CRASH'
  | 'CHUNK_LOAD_ERROR'
  | 'INVALID_CACHE'
  | 'RATE_LIMIT'
  | 'VALIDATION_ERROR'
  | 'UNKNOWN_ERROR';

export class AppError extends Error {
  public readonly code: AppErrorCode;
  public readonly isRetryable: boolean;
  public readonly originalError?: unknown;

  constructor(message: string, code: AppErrorCode = 'UNKNOWN_ERROR', isRetryable = false, originalError?: unknown) {
    super(message);
    this.name = 'AppError';
    this.code = code;
    this.isRetryable = isRetryable;
    this.originalError = originalError;
  }
}

export interface RetryOptions {
  maxRetries?: number;
  initialDelayMs?: number;
  maxDelayMs?: number;
  backoffFactor?: number;
  shouldRetry?: (error: unknown, attempt: number) => boolean;
  onRetry?: (error: unknown, attempt: number, delayMs: number) => void;
}

export function classifyError(error: unknown): AppError {
  if (error instanceof AppError) return error;

  const errString = String(error).toLowerCase();
  const errMsg = (error as any)?.message || String(error);

  if (errString.includes('failed to fetch') || errString.includes('network') || errString.includes('offline')) {
    return new AppError('Koneksi jaringan terputus atau tidak stabil.', 'NETWORK_ERROR', true, error);
  }

  if (errString.includes('429') || errString.includes('rate limit') || errString.includes('too many requests')) {
    return new AppError('Terlalu banyak permintaan. Silakan tunggu sejenak.', 'RATE_LIMIT', true, error);
  }

  if (errString.includes('timeout') || errString.includes('timed out') || errString.includes('abort')) {
    return new AppError('Waktu permintaan habis (timeout).', 'API_TIMEOUT', true, error);
  }

  if (errString.includes('401') || errString.includes('unauthorized') || errString.includes('auth/id-token-expired')) {
    return new AppError('Sesi autentikasi Anda telah berakhir.', 'AUTH_EXPIRED', false, error);
  }

  if (errString.includes('dynamically imported module') || errString.includes('chunkloaderror')) {
    return new AppError('Gagal memuat modul aplikasi terbaru. Silakan refresh halaman.', 'CHUNK_LOAD_ERROR', true, error);
  }

  return new AppError(errMsg || 'Terjadi kesalahan sistem yang tidak terduga.', 'UNKNOWN_ERROR', false, error);
}

/**
 * Execute an async operation with exponential backoff and jitter
 */
export async function withRetry<T>(
  operation: () => Promise<T>,
  options: RetryOptions = {}
): Promise<T> {
  const {
    maxRetries = 3,
    initialDelayMs = 400,
    maxDelayMs = 4000,
    backoffFactor = 2,
    shouldRetry = (err) => {
      const classified = classifyError(err);
      return classified.isRetryable;
    },
    onRetry
  } = options;

  let attempt = 0;

  while (true) {
    try {
      return await operation();
    } catch (error) {
      attempt++;
      if (attempt > maxRetries || !shouldRetry(error, attempt)) {
        logger.error(`Operation failed after ${attempt} attempts`, {
          code: classifyError(error).code,
          error: error instanceof Error ? error : new Error(String(error))
        });
        throw classifyError(error);
      }

      // Calculate exponential backoff with full jitter
      const rawDelay = initialDelayMs * Math.pow(backoffFactor, attempt - 1);
      const boundedDelay = Math.min(rawDelay, maxDelayMs);
      const jitterDelay = Math.floor(Math.random() * (boundedDelay / 2) + boundedDelay / 2);

      logger.warn(`Retry attempt ${attempt}/${maxRetries} after ${jitterDelay}ms`, {
        code: classifyError(error).code
      });

      if (onRetry) {
        onRetry(error, attempt, jitterDelay);
      }

      await new Promise((resolve) => setTimeout(resolve, jitterDelay));
    }
  }
}
