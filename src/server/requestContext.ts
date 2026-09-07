import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';
import { ApiErrorCode, ApiError, ApiErrorResponse } from './errors';

declare global {
  namespace Express {
    interface Request {
      id: string;
      startTime: number;
    }
  }
}

/**
 * Middleware: Attaches a unique request correlation ID to every incoming request
 */
export function requestCorrelationMiddleware(req: Request, res: Response, next: NextFunction) {
  const incomingId = req.headers['x-request-id'];
  const requestId = (typeof incomingId === 'string' && incomingId.trim().length > 0)
    ? incomingId.trim()
    : `req_${Date.now()}_${crypto.randomBytes(6).toString('hex')}`;

  req.id = requestId;
  req.startTime = Date.now();
  res.setHeader('x-request-id', requestId);
  next();
}

/**
 * Standardized API Error Helper with strict type enforcement
 */
export function sendApiError(
  res: Response,
  statusCode: number,
  code: ApiErrorCode,
  message: string,
  extra?: Record<string, unknown>
) {
  const req = res.req as Request;
  const errorResponse: ApiErrorResponse = {
    success: false,
    code,
    message,
    requestId: req?.id,
    ...extra
  };
  return res.status(statusCode).json(errorResponse);
}

export function handleServerException(err: unknown, req: Request, res: Response) {
  if (err instanceof ApiError) {
    return sendApiError(res, err.status, err.code, err.message, {
      ...err.details,
      requestId: req.id || err.requestId
    });
  }

  const genericErr = err as { status?: number; statusCode?: number; code?: string; message?: string };
  const status = genericErr?.status || genericErr?.statusCode || 500;
  const code = (genericErr?.code as ApiErrorCode) || 'INTERNAL_SERVER_ERROR';
  const message = process.env.NODE_ENV === 'production'
    ? 'Terjadi kendala pada server. Tim kami telah mencatat insiden ini.'
    : genericErr?.message || 'Internal Server Error';

  return sendApiError(res, status, code, message, { requestId: req.id });
}
