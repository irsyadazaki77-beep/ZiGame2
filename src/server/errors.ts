/**
 * Authoritative Typed Error Architecture
 * ZiGame 2.0 Stabilization & Production Quality
 */

export type ApiErrorCode =
  | 'SERVICE_UNAVAILABLE'
  | 'UNAUTHORIZED'
  | 'TOKEN_EXPIRED'
  | 'INVALID_TOKEN'
  | 'FORBIDDEN'
  | 'INVALID_GAME_ID'
  | 'INVALID_SCORE'
  | 'VERIFIED_SESSION_REQUIRED'
  | 'INVALID_IDEMPOTENCY_KEY'
  | 'SESSION_NOT_FOUND'
  | 'SESSION_EXPIRED'
  | 'SESSION_ALREADY_CONSUMED'
  | 'SCORE_CEILING_EXCEEDED'
  | 'INSUFFICIENT_DURATION'
  | 'INSUFFICIENT_FUNDS'
  | 'ITEM_NOT_FOUND'
  | 'ITEM_ALREADY_OWNED'
  | 'SPIN_COOLDOWN'
  | 'RATE_LIMIT_EXCEEDED'
  | 'MALFORMED_PAYLOAD'
  | 'INVALID_EVENT_TYPE'
  | 'INVALID_TELEMETRY_DATA'
  | 'INTERNAL_SERVER_ERROR'
  | 'INTERNAL_ERROR';

export interface ApiErrorResponse {
  success: false;
  code: ApiErrorCode;
  message: string;
  requestId?: string;
  details?: Record<string, unknown>;
  retryAfterSeconds?: number;
}

export class ApiError extends Error {
  public readonly code: ApiErrorCode;
  public readonly status: number;
  public readonly details?: Record<string, unknown>;
  public readonly requestId?: string;

  constructor(
    status: number,
    code: ApiErrorCode,
    message: string,
    details?: Record<string, unknown>,
    requestId?: string
  ) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    Object.setPrototypeOf(this, ApiError.prototype);
  }

  static unauthorized(message = 'Akses ditolak. Silakan login terlebih dahulu.', code: ApiErrorCode = 'UNAUTHORIZED'): ApiError {
    return new ApiError(401, code, message);
  }

  static forbidden(message = 'Akses ditolak. Anda tidak memiliki izin untuk tindakan ini.', code: ApiErrorCode = 'FORBIDDEN'): ApiError {
    return new ApiError(403, code, message);
  }

  static badRequest(message: string, code: ApiErrorCode = 'MALFORMED_PAYLOAD', details?: Record<string, unknown>): ApiError {
    return new ApiError(400, code, message, details);
  }

  static notFound(message: string, code: ApiErrorCode = 'ITEM_NOT_FOUND'): ApiError {
    return new ApiError(404, code, message);
  }

  static unprocessable(message: string, code: ApiErrorCode = 'VERIFIED_SESSION_REQUIRED', details?: Record<string, unknown>): ApiError {
    return new ApiError(422, code, message, details);
  }

  static rateLimit(message = 'Terlalu banyak permintaan. Silakan coba beberapa saat lagi.', details?: Record<string, unknown>): ApiError {
    return new ApiError(429, 'RATE_LIMIT_EXCEEDED', message, details);
  }

  static serviceUnavailable(message = 'Layanan backend tidak tersedia saat ini.', code: ApiErrorCode = 'SERVICE_UNAVAILABLE'): ApiError {
    return new ApiError(503, code, message);
  }

  static internal(message = 'Terjadi kesalahan internal server.', code: ApiErrorCode = 'INTERNAL_SERVER_ERROR'): ApiError {
    return new ApiError(500, code, message);
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}
