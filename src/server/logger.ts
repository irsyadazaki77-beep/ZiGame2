/**
 * Backend Structured Observability & Security Logger
 * ZiGame 2.0 Stabilization
 */

export type ServerLogLevel = 'INFO' | 'WARN' | 'ERROR' | 'SECURITY';

export type SecurityEventCategory =
  | 'AUTH_FAILURE'
  | 'RATE_LIMIT'
  | 'SUSPICIOUS_SCORE'
  | 'PURCHASE'
  | 'REWARD'
  | 'ADMIN_ACTION'
  | 'FIREBASE_FAILURE'
  | 'SERVER_ERROR';

export interface StructuredLogEntry {
  level: ServerLogLevel;
  category: SecurityEventCategory | string;
  message: string;
  timestamp: string;
  userId?: string;
  ip?: string;
  metadata?: Record<string, any>;
  error?: string;
}

/**
 * Strips sensitive strings like tokens, passwords, private keys from metadata
 */
function sanitizeMetadata(data: Record<string, any> | undefined): Record<string, any> | undefined {
  if (!data) return undefined;
  const sanitized: Record<string, any> = {};
  for (const [key, value] of Object.entries(data)) {
    const lower = key.toLowerCase();
    if (
      lower.includes('token') ||
      lower.includes('password') ||
      lower.includes('secret') ||
      lower.includes('credential') ||
      lower.includes('key') ||
      lower.includes('auth')
    ) {
      sanitized[key] = '[REDACTED]';
    } else if (typeof value === 'object' && value !== null) {
      sanitized[key] = sanitizeMetadata(value);
    } else {
      sanitized[key] = value;
    }
  }
  return sanitized;
}

export const serverLogger = {
  log(entry: Omit<StructuredLogEntry, 'timestamp'>) {
    const fullEntry: StructuredLogEntry = {
      ...entry,
      metadata: sanitizeMetadata(entry.metadata),
      timestamp: new Date().toISOString()
    };

    const formatted = `[${fullEntry.timestamp}] [${fullEntry.level}] [${fullEntry.category}] ${fullEntry.message}` +
      (fullEntry.userId ? ` (uid: ${fullEntry.userId})` : '') +
      (fullEntry.ip ? ` (ip: ${fullEntry.ip})` : '') +
      (fullEntry.metadata ? ` | meta: ${JSON.stringify(fullEntry.metadata)}` : '') +
      (fullEntry.error ? ` | err: ${fullEntry.error}` : '');

    if (fullEntry.level === 'ERROR' || fullEntry.level === 'SECURITY') {
      console.error(formatted);
    } else if (fullEntry.level === 'WARN') {
      console.warn(formatted);
    } else {
      console.log(formatted);
    }
  },

  info(category: string, message: string, metadata?: Record<string, any>, userId?: string, ip?: string) {
    this.log({ level: 'INFO', category, message, metadata, userId, ip });
  },

  warn(category: string, message: string, metadata?: Record<string, any>, userId?: string, ip?: string) {
    this.log({ level: 'WARN', category, message, metadata, userId, ip });
  },

  error(category: string, message: string, err?: unknown, metadata?: Record<string, any>, userId?: string, ip?: string) {
    const errorMsg = err instanceof Error ? err.stack || err.message : String(err || '');
    this.log({ level: 'ERROR', category, message, error: errorMsg, metadata, userId, ip });
  },

  security(category: SecurityEventCategory, message: string, metadata?: Record<string, any>, userId?: string, ip?: string) {
    this.log({ level: 'SECURITY', category, message, metadata, userId, ip });
  }
};
