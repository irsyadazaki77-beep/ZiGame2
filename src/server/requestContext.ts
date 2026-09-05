import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

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
 * Standardized API Error Helper
 */
export function sendApiError(
  res: Response,
  statusCode: number,
  code: string,
  message: string,
  extra?: Record<string, any>
) {
  const req = res.req as Request;
  return res.status(statusCode).json({
    success: false,
    code,
    message,
    requestId: req?.id,
    ...extra
  });
}
