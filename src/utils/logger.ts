export type LogLevel = 'debug' | 'info' | 'warn' | 'error' | 'fatal';

export interface StructuredLog {
  level: LogLevel;
  code?: string;
  message: string;
  timestamp: string;
  environment: string;
  buildVersion: string;
  userId?: string;
  gameId?: string;
  sessionId?: string;
  requestId?: string;
  context?: Record<string, any>;
  stack?: string;
}

const BUILD_VERSION = 'v2.4.0-prod';
const ENVIRONMENT = process.env.NODE_ENV === 'production' ? 'production' : 'development';

// Ring buffer for keeping the last 100 structured telemetry events locally
const MAX_LOG_BUFFER = 100;
const logBuffer: StructuredLog[] = [];

// Sensitive field keys to redact
const SENSITIVE_KEYS = ['password', 'passwordHash', 'token', 'apiKey', 'secret', 'authorization', 'bearer'];

function sanitizeContext(data: any): any {
  if (!data || typeof data !== 'object') return data;
  if (Array.isArray(data)) return data.map(sanitizeContext);

  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    if (SENSITIVE_KEYS.some(s => key.toLowerCase().includes(s))) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeContext(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

class Logger {
  private baseContext: Record<string, any> = {};

  public setBaseContext(ctx: Record<string, any>) {
    this.baseContext = { ...this.baseContext, ...ctx };
  }

  private write(level: LogLevel, message: string, meta?: {
    code?: string;
    gameId?: string;
    sessionId?: string;
    requestId?: string;
    userId?: string;
    context?: Record<string, any>;
    error?: Error;
  }) {
    const entry: StructuredLog = {
      level,
      code: meta?.code,
      message,
      timestamp: new Date().toISOString(),
      environment: ENVIRONMENT,
      buildVersion: BUILD_VERSION,
      userId: meta?.userId || this.baseContext.userId,
      gameId: meta?.gameId || this.baseContext.gameId,
      sessionId: meta?.sessionId || this.baseContext.sessionId,
      requestId: meta?.requestId,
      context: meta?.context ? sanitizeContext(meta.context) : undefined,
      stack: meta?.error ? (ENVIRONMENT === 'development' ? meta.error.stack : meta.error.message) : undefined
    };

    // Store in ring buffer
    if (logBuffer.length >= MAX_LOG_BUFFER) {
      logBuffer.shift();
    }
    logBuffer.push(entry);

    // Formatted output
    const prefix = `[ZiGame][${entry.level.toUpperCase()}][${entry.code || 'SYS'}]`;
    if (level === 'error' || level === 'fatal') {
      console.error(prefix, message, entry.context || '', entry.stack || '');
    } else if (level === 'warn') {
      console.warn(prefix, message, entry.context || '');
    } else if (level === 'info') {
      console.info(prefix, message, entry.context || '');
    } else if (ENVIRONMENT === 'development') {
      console.debug(prefix, message, entry.context || '');
    }
  }

  public debug(message: string, meta?: Parameters<Logger['write']>[2]) {
    this.write('debug', message, meta);
  }

  public info(message: string, meta?: Parameters<Logger['write']>[2]) {
    this.write('info', message, meta);
  }

  public warn(message: string, meta?: Parameters<Logger['write']>[2]) {
    this.write('warn', message, meta);
  }

  public error(message: string, meta?: Parameters<Logger['write']>[2]) {
    this.write('error', message, meta);
  }

  public fatal(message: string, meta?: Parameters<Logger['write']>[2]) {
    this.write('fatal', message, meta);
  }

  public getRecentLogs(): StructuredLog[] {
    return [...logBuffer];
  }

  public clearLogs() {
    logBuffer.length = 0;
  }
}

export const logger = new Logger();
