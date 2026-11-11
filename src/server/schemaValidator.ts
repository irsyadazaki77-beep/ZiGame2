import { Request, Response, NextFunction } from 'express';
import { ApiErrorCode } from './errors';
import { sendApiError } from './requestContext';
import { isValidGameId } from '../config/canonicalGames';
import { isValidIdempotencyKey } from './persistence';

export interface FieldRule {
  type: 'string' | 'number' | 'boolean' | 'object' | 'array';
  required?: boolean;
  min?: number;
  max?: number;
  minExclusive?: number;
  maxLength?: number;
  maxItems?: number;
  enumValues?: readonly (string | number | boolean)[];
  customValidator?: (val: unknown, body: Record<string, unknown>) => boolean;
  statusCode?: number;
  errorCode: ApiErrorCode;
  errorMessage: string;
}

export interface EndpointSchema {
  name: string;
  description: string;
  fields: Record<string, FieldRule>;
  customBodyValidator?: (body: Record<string, unknown>) => {
    valid: boolean;
    statusCode?: number;
    errorCode?: ApiErrorCode;
    errorMessage?: string;
  };
  stripUnknown?: boolean;
}

const REGISTERED_SCHEMAS: Map<string, EndpointSchema> = new Map();

/**
 * Validates a request payload against a declarative EndpointSchema.
 * Strips unknown properties when stripUnknown !== false to prevent mass-assignment.
 */
export function validatePayloadAgainstSchema(
  rawBody: unknown,
  schema: EndpointSchema
): {
  valid: boolean;
  sanitizedBody?: Record<string, unknown>;
  statusCode?: number;
  errorCode?: ApiErrorCode;
  errorMessage?: string;
} {
  const body: Record<string, unknown> =
    rawBody && typeof rawBody === 'object' && !Array.isArray(rawBody)
      ? (rawBody as Record<string, unknown>)
      : {};

  // Check field rules in declaration order
  for (const [fieldName, rule] of Object.entries(schema.fields)) {
    const val = body[fieldName];

    if (val === undefined || val === null || (rule.type === 'string' && rule.required && val === '')) {
      if (rule.required) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
      continue;
    }

    // Type check
    if (rule.type === 'array') {
      if (!Array.isArray(val)) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
      if (rule.maxItems !== undefined && val.length > rule.maxItems) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
    } else if (rule.type === 'object') {
      if (typeof val !== 'object' || Array.isArray(val)) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
    } else if (typeof val !== rule.type) {
      return {
        valid: false,
        statusCode: rule.statusCode || 400,
        errorCode: rule.errorCode,
        errorMessage: rule.errorMessage
      };
    }

    // Numeric bounds
    if (rule.type === 'number' && typeof val === 'number') {
      if (!Number.isFinite(val)) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
      if (rule.min !== undefined && val < rule.min) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
      if (rule.minExclusive !== undefined && val <= rule.minExclusive) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
      if (rule.max !== undefined && val > rule.max) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
    }

    // String bounds
    if (rule.type === 'string' && typeof val === 'string') {
      if (rule.maxLength !== undefined && val.length > rule.maxLength) {
        return {
          valid: false,
          statusCode: rule.statusCode || 400,
          errorCode: rule.errorCode,
          errorMessage: rule.errorMessage
        };
      }
    }

    // Enum check
    if (rule.enumValues && !rule.enumValues.includes(val as string | number | boolean)) {
      return {
        valid: false,
        statusCode: rule.statusCode || 400,
        errorCode: rule.errorCode,
        errorMessage: rule.errorMessage
      };
    }

    // Custom validator
    if (rule.customValidator && !rule.customValidator(val, body)) {
      return {
        valid: false,
        statusCode: rule.statusCode || 400,
        errorCode: rule.errorCode,
        errorMessage: rule.errorMessage
      };
    }
  }

  if (schema.customBodyValidator) {
    const customRes = schema.customBodyValidator(body);
    if (!customRes.valid) {
      return {
        valid: false,
        statusCode: customRes.statusCode || 400,
        errorCode: customRes.errorCode || 'MALFORMED_PAYLOAD',
        errorMessage: customRes.errorMessage || 'Payload permintaan tidak valid.'
      };
    }
  }

  // Strip unknown properties unless explicitly disabled
  const stripUnknown = schema.stripUnknown !== false;
  if (!stripUnknown) {
    return { valid: true, sanitizedBody: { ...body } };
  }

  const allowedKeys = new Set([...Object.keys(schema.fields), 'userId']);
  const sanitizedBody: Record<string, unknown> = {};
  for (const [k, v] of Object.entries(body)) {
    if (allowedKeys.has(k) && v !== undefined) {
      sanitizedBody[k] = v;
    }
  }

  return { valid: true, sanitizedBody };
}

/**
 * Express middleware factory that enforces an EndpointSchema at the route entry boundary.
 */
export function validateBody(schema: EndpointSchema) {
  REGISTERED_SCHEMAS.set(schema.name, schema);

  return (req: Request, res: Response, next: NextFunction) => {
    const rawHeaderKey = req.headers['x-idempotency-key'];
    const headerIdempotencyKey = typeof rawHeaderKey === 'string' ? rawHeaderKey.trim() : undefined;

    if (headerIdempotencyKey && req.body && typeof req.body === 'object' && !Array.isArray(req.body)) {
      const bodyKey = (req.body as Record<string, unknown>).idempotencyKey;
      if (typeof bodyKey === 'string' && bodyKey.trim().length > 0 && bodyKey.trim() !== headerIdempotencyKey) {
        return sendApiError(
          res,
          409,
          'IDEMPOTENCY_CONFLICT',
          'Header X-Idempotency-Key tidak cocok dengan idempotencyKey pada body.'
        );
      }
      if (bodyKey === undefined && 'idempotencyKey' in schema.fields) {
        (req.body as Record<string, unknown>).idempotencyKey = headerIdempotencyKey;
      }
    }

    const result = validatePayloadAgainstSchema(req.body, schema);
    if (!result.valid) {
      return sendApiError(
        res,
        result.statusCode || 400,
        result.errorCode || 'MALFORMED_PAYLOAD',
        result.errorMessage || 'Format data permintaan tidak valid.'
      );
    }
    req.body = result.sanitizedBody;
    next();
  };
}

export function getRegisteredSchemasSummary() {
  return Array.from(REGISTERED_SCHEMAS.values()).map((s) => ({
    name: s.name,
    description: s.description,
    fieldsCount: Object.keys(s.fields).length,
    strictAllowlist: s.stripUnknown !== false
  }));
}

// ============================================================================
// CANONICAL API ENDPOINT SCHEMAS
// ============================================================================

export const sessionStartSchema: EndpointSchema = {
  name: 'sessionStartSchema',
  description: 'Validasi pembuatan tiket sesi game kasual & ranked',
  fields: {
    gameId: {
      type: 'string',
      required: true,
      customValidator: (val) => typeof val === 'string' && isValidGameId(val),
      errorCode: 'INVALID_GAME_ID',
      errorMessage: 'ID Game tidak valid atau tidak terdaftar.'
    },
    nonce: {
      type: 'string',
      required: false,
      maxLength: 128,
      customValidator: (val) => typeof val === 'string' && /^[a-zA-Z0-9_-]{4,128}$/.test(val),
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Format nonce sesi tidak valid.'
    },
    sessionNonce: {
      type: 'string',
      required: false,
      maxLength: 128,
      customValidator: (val) => typeof val === 'string' && /^[a-zA-Z0-9_-]{4,128}$/.test(val),
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Format sessionNonce tidak valid.'
    },
    timestamp: {
      type: 'number',
      required: false,
      min: 0,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Timestamp awal sesi tidak valid.'
    },
    clientTimestamp: {
      type: 'number',
      required: false,
      min: 0,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Client timestamp sesi tidak valid.'
    }
  }
};

export const scoreSubmitSchema: EndpointSchema = {
  name: 'scoreSubmitSchema',
  description: 'Validasi pengiriman skor sesi kasual dan bukti HMAC',
  fields: {
    gameId: {
      type: 'string',
      required: true,
      customValidator: (val) => typeof val === 'string' && isValidGameId(val),
      errorCode: 'INVALID_GAME_ID',
      errorMessage: 'ID Game tidak valid atau tidak terdaftar.'
    },
    score: {
      type: 'number',
      required: true,
      min: 0,
      errorCode: 'INVALID_SCORE',
      errorMessage: 'Nilai skor tidak valid.'
    },
    sessionId: {
      type: 'string',
      required: true,
      statusCode: 422,
      errorCode: 'VERIFIED_SESSION_REQUIRED',
      errorMessage: 'ID Sesi permainan (sessionId) wajib disertakan untuk submission skor.'
    },
    idempotencyKey: {
      type: 'string',
      required: false,
      customValidator: (val) => typeof val === 'string' && isValidIdempotencyKey(val),
      errorCode: 'INVALID_IDEMPOTENCY_KEY',
      errorMessage: 'Kunci idempotency tidak valid.'
    },
    playerName: {
      type: 'string',
      required: false,
      maxLength: 64,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Nama pemain tidak valid.'
    },
    playerAvatar: {
      type: 'string',
      required: false,
      maxLength: 32,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Avatar pemain tidak valid.'
    },
    durationMs: {
      type: 'number',
      required: false,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Durasi permainan tidak valid.'
    },
    masteryLevel: {
      type: 'number',
      required: false,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Level mastery tidak valid.'
    },
    nonce: {
      type: 'string',
      required: false,
      maxLength: 128,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Nonce sesi tidak valid.'
    },
    signature: {
      type: 'string',
      required: false,
      maxLength: 128,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Format signature sesi tidak valid.'
    },
    clientProof: {
      type: 'string',
      required: false,
      maxLength: 128,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Format bukti klien tidak valid.'
    }
  }
};

export const rankedSubmitSchema: EndpointSchema = {
  name: 'rankedSubmitSchema',
  description: 'Validasi pengiriman skor kompetitif (Ranked) & idempotency ketat',
  fields: {
    gameId: {
      type: 'string',
      required: true,
      customValidator: (val) => typeof val === 'string' && isValidGameId(val),
      errorCode: 'INVALID_GAME_ID',
      errorMessage: 'ID Game tidak valid.'
    },
    score: {
      type: 'number',
      required: true,
      min: 0,
      errorCode: 'INVALID_SCORE',
      errorMessage: 'Skor tidak valid.'
    },
    sessionId: {
      type: 'string',
      required: true,
      statusCode: 422,
      errorCode: 'SESSION_REQUIRED',
      errorMessage: 'ID Sesi ranked wajib disertakan.'
    },
    idempotencyKey: {
      type: 'string',
      required: true,
      customValidator: (val) => typeof val === 'string' && isValidIdempotencyKey(val),
      errorCode: 'INVALID_IDEMPOTENCY_KEY',
      errorMessage: 'Kunci idempotency wajib disertakan dan harus valid.'
    },
    playerName: {
      type: 'string',
      required: false,
      maxLength: 64,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Nama pemain tidak valid.'
    },
    playerAvatar: {
      type: 'string',
      required: false,
      maxLength: 32,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Avatar pemain tidak valid.'
    },
    durationMs: {
      type: 'number',
      required: false,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Durasi permainan tidak valid.'
    },
    masteryLevel: {
      type: 'number',
      required: false,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Level mastery tidak valid.'
    },
    nonce: {
      type: 'string',
      required: false,
      maxLength: 128,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Nonce sesi tidak valid.'
    },
    signature: {
      type: 'string',
      required: false,
      maxLength: 128,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Format signature sesi tidak valid.'
    },
    clientProof: {
      type: 'string',
      required: false,
      maxLength: 128,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Format bukti klien tidak valid.'
    }
  }
};

export const buyItemSchema: EndpointSchema = {
  name: 'buyItemSchema',
  description: 'Validasi pembelian item katalog toko otoritatif',
  fields: {
    itemId: {
      type: 'string',
      required: true,
      maxLength: 64,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'ID Item toko wajib diisi.'
    },
    idempotencyKey: {
      type: 'string',
      required: true,
      customValidator: (val) => typeof val === 'string' && isValidIdempotencyKey(val),
      errorCode: 'INVALID_IDEMPOTENCY_KEY',
      errorMessage: 'Kunci idempotency valid wajib disertakan untuk transaksi.'
    }
  }
};

export const gambleSchema: EndpointSchema = {
  name: 'gambleSchema',
  description: 'Validasi taruhan koin 50/50 otoritatif',
  fields: {
    bet: {
      type: 'number',
      required: true,
      minExclusive: 0,
      errorCode: 'INVALID_BET',
      errorMessage: 'Nilai taruhan koin tidak valid.'
    },
    choice: {
      type: 'string',
      required: true,
      enumValues: ['heads', 'tails'],
      errorCode: 'INVALID_CHOICE',
      errorMessage: 'Pilihan harus "heads" atau "tails".'
    },
    idempotencyKey: {
      type: 'string',
      required: true,
      customValidator: (val) => typeof val === 'string' && isValidIdempotencyKey(val),
      errorCode: 'INVALID_IDEMPOTENCY_KEY',
      errorMessage: 'Kunci idempotency valid wajib disertakan untuk taruhan.'
    }
  }
};

export const gachaSchema: EndpointSchema = {
  name: 'gachaSchema',
  description: 'Validasi undian mesin gacha otoritatif',
  fields: {
    idempotencyKey: {
      type: 'string',
      required: true,
      customValidator: (val) => typeof val === 'string' && isValidIdempotencyKey(val),
      errorCode: 'INVALID_IDEMPOTENCY_KEY',
      errorMessage: 'Kunci idempotency valid wajib disertakan untuk gacha.'
    }
  }
};

export const claimRewardSchema: EndpointSchema = {
  name: 'claimRewardSchema',
  description: 'Validasi klaim hadiah misi, tantangan, dan achievement',
  fields: {
    claimId: {
      type: 'string',
      required: false,
      maxLength: 128,
      errorCode: 'INVALID_REWARD_CLAIM',
      errorMessage: 'ID klaim reward (claimId) wajib disertakan.'
    },
    reason: {
      type: 'string',
      required: false,
      maxLength: 128,
      errorCode: 'INVALID_REWARD_CLAIM',
      errorMessage: 'Alasan klaim tidak valid.'
    },
    claimType: {
      type: 'string',
      required: false,
      maxLength: 64,
      errorCode: 'INVALID_REWARD_CLAIM',
      errorMessage: 'Tipe klaim tidak valid.'
    },
    details: {
      type: 'object',
      required: false,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Detail klaim harus berupa objek.'
    },
    idempotencyKey: {
      type: 'string',
      required: false,
      errorCode: 'INVALID_IDEMPOTENCY_KEY',
      errorMessage: 'Kunci idempotency valid wajib disertakan untuk klaim reward.'
    }
  },
  customBodyValidator: (body) => {
    const resolvedClaimId =
      typeof body.claimId === 'string' && body.claimId.trim()
        ? body.claimId
        : typeof body.reason === 'string' && body.reason.trim()
        ? body.reason
        : undefined;
    if (!resolvedClaimId) {
      return {
        valid: false,
        statusCode: 400,
        errorCode: 'INVALID_REWARD_CLAIM',
        errorMessage: 'ID klaim reward (claimId) wajib disertakan.'
      };
    }
    if (
      typeof body.idempotencyKey !== 'string' ||
      !isValidIdempotencyKey(body.idempotencyKey)
    ) {
      return {
        valid: false,
        statusCode: 400,
        errorCode: 'INVALID_IDEMPOTENCY_KEY',
        errorMessage: 'Kunci idempotency valid wajib disertakan untuk klaim reward.'
      };
    }
    return { valid: true };
  }
};

export const killSwitchSchema: EndpointSchema = {
  name: 'killSwitchSchema',
  description: 'Validasi sakelar darurat (Kill Switch) fitur server',
  fields: {
    feature: {
      type: 'string',
      required: true,
      enumValues: ['ranked', 'economy', 'seasons'],
      errorCode: 'INVALID_FEATURE',
      errorMessage: 'Fitur kill switch harus ranked, economy, atau seasons.'
    },
    active: {
      type: 'boolean',
      required: true,
      errorCode: 'INVALID_VALUE',
      errorMessage: 'Nilai active harus berupa boolean.'
    }
  }
};

export const adminUserTargetSchema: EndpointSchema = {
  name: 'adminUserTargetSchema',
  description: 'Validasi target User ID pada operasi audit dan unban admin',
  fields: {
    userId: {
      type: 'string',
      required: true,
      maxLength: 128,
      customValidator: (val) => typeof val === 'string' && val.trim().length > 0,
      errorCode: 'INVALID_USER_ID',
      errorMessage: 'User ID wajib disertakan.'
    }
  }
};

export const adminBanUserSchema: EndpointSchema = {
  name: 'adminBanUserSchema',
  description: 'Validasi perintah pembekuan akun pengguna oleh Admin',
  fields: {
    userId: {
      type: 'string',
      required: true,
      maxLength: 128,
      customValidator: (val) => typeof val === 'string' && val.trim().length > 0,
      errorCode: 'INVALID_USER_ID',
      errorMessage: 'User ID wajib disertakan untuk pemblokiran.'
    },
    reason: {
      type: 'string',
      required: false,
      maxLength: 256,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Alasan pemblokiran tidak valid.'
    },
    durationMinutes: {
      type: 'number',
      required: false,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Durasi menit tidak valid.'
    },
    durationHours: {
      type: 'number',
      required: false,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Durasi jam tidak valid.'
    }
  }
};

export const adminPurgeSchema: EndpointSchema = {
  name: 'adminPurgeSchema',
  description: 'Validasi pembersihan skor mencurigakan oleh Admin',
  fields: {
    gameId: {
      type: 'string',
      required: false,
      customValidator: (val) => typeof val === 'string' && isValidGameId(val),
      errorCode: 'INVALID_GAME_ID',
      errorMessage: 'ID Game tidak valid.'
    }
  }
};

const ALLOWED_TELEMETRY_EVENTS = [
  'game_start',
  'game_end',
  'restart',
  'pause',
  'crash',
  'tutorial_complete',
  'performance_sample',
  'tutorial_view',
  'quit',
  'gameover'
] as const;

export const telemetrySchema: EndpointSchema = {
  name: 'telemetrySchema',
  description: 'Validasi event telemetri permainan',
  fields: {
    eventType: {
      type: 'string',
      required: true,
      enumValues: ALLOWED_TELEMETRY_EVENTS,
      errorCode: 'INVALID_EVENT_TYPE',
      errorMessage: 'Jenis event telemetri tidak diizinkan.'
    },
    gameId: {
      type: 'string',
      required: false,
      maxLength: 64,
      errorCode: 'INVALID_TELEMETRY_DATA',
      errorMessage: 'gameId melebihi batas panjang yang diizinkan.'
    },
    durationMs: {
      type: 'number',
      required: false,
      min: 0,
      max: 86400000,
      errorCode: 'INVALID_TELEMETRY_DATA',
      errorMessage: 'durationMs di luar rentang valid.'
    },
    score: {
      type: 'number',
      required: false,
      min: 0,
      max: 10000000,
      errorCode: 'INVALID_TELEMETRY_DATA',
      errorMessage: 'score di luar rentang valid.'
    },
    metadata: {
      type: 'object',
      required: false,
      errorCode: 'INVALID_TELEMETRY_DATA',
      errorMessage: 'Format metadata telemetri tidak valid.'
    }
  }
};

export const analyticsBatchSchema: EndpointSchema = {
  name: 'analyticsBatchSchema',
  description: 'Validasi batch event analitik klien',
  fields: {
    events: {
      type: 'array',
      required: true,
      maxItems: 100,
      errorCode: 'MALFORMED_PAYLOAD',
      errorMessage: 'Format batch event analitik tidak valid.'
    }
  }
};

// Pre-register all schemas for diagnostic reporting
[
  sessionStartSchema,
  scoreSubmitSchema,
  rankedSubmitSchema,
  buyItemSchema,
  gambleSchema,
  gachaSchema,
  claimRewardSchema,
  killSwitchSchema,
  adminUserTargetSchema,
  adminBanUserSchema,
  adminPurgeSchema,
  telemetrySchema,
  analyticsBatchSchema
].forEach((s) => REGISTERED_SCHEMAS.set(s.name, s));
