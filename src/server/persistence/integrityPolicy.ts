import { CanonicalGameId } from '../../config/canonicalGames';
import { getGameBalanceConfig, GameBalanceConfig } from '../../config/balanceConfig';
import { ApiErrorCode } from '../errors';
import { AnomalySeverity } from './db';

export type GameMode = 'casual' | 'ranked';

export interface IntegrityPolicy {
  mode: GameMode;
  enforceScoreCeiling: boolean;
  enforceVelocity: boolean;
  enforceDuration: boolean;
  enforceInputTelemetry: boolean;
  requireVerifiedSession: boolean;
  maxVelocityMargin: number;
}

export interface InputTelemetryPayload {
  inputCount?: number;
  actionSequence?: number;
  durationMs?: number;
}

export interface AnomalyReport {
  detected: boolean;
  severity: AnomalySeverity;
  reason: string;
  durationMs: number;
  scoreVelocity: number;
  details?: Record<string, any>;
}

export interface IntegrityEvaluationResult {
  valid: boolean;
  errorCode?: ApiErrorCode;
  errorMessage?: string;
  anomalyReport?: AnomalyReport;
  scoreVelocity: number;
  verifiedDurationMs: number;
}

export function getIntegrityPolicy(mode: GameMode = 'casual'): IntegrityPolicy {
  if (mode === 'ranked') {
    return {
      mode: 'ranked',
      enforceScoreCeiling: true,
      enforceVelocity: true,
      enforceDuration: true,
      enforceInputTelemetry: true,
      requireVerifiedSession: true,
      maxVelocityMargin: 1.0 // Strict threshold without slack
    };
  }

  return {
    mode: 'casual',
    enforceScoreCeiling: true,
    enforceVelocity: true,
    enforceDuration: true,
    enforceInputTelemetry: false,
    requireVerifiedSession: true,
    maxVelocityMargin: 1.25 // Generous margin for network fluctuations in casual
  };
}

/**
 * Multi-layer score plausibility evaluation
 * Layer 1: Structural number validation
 * Layer 2: Hard ceiling verification
 * Layer 3: Temporal minimum duration check
 * Layer 4: Velocity validation based on canonical game balance
 * Layer 5: Ranked input telemetry plausibility
 */
export function evaluateScoreIntegrity(
  gameId: CanonicalGameId,
  score: number,
  verifiedDurationMs: number,
  mode: GameMode = 'casual',
  inputTelemetry?: InputTelemetryPayload
): IntegrityEvaluationResult {
  const policy = getIntegrityPolicy(mode);
  const config = getGameBalanceConfig(gameId);

  // 1. Layer 1: Structural & Number Sanity
  if (typeof score !== 'number' || !Number.isFinite(score) || Number.isNaN(score) || score < 0 || !Number.isInteger(score)) {
    return {
      valid: false,
      errorCode: 'INVALID_SCORE',
      errorMessage: 'Nilai skor tidak valid, harus berupa bilangan bulat positif.',
      anomalyReport: {
        detected: true,
        severity: 'HIGH',
        reason: `Invalid structural score: ${score}`,
        durationMs: verifiedDurationMs,
        scoreVelocity: 0
      },
      scoreVelocity: 0,
      verifiedDurationMs
    };
  }

  if (score > 10_000_000) {
    return {
      valid: false,
      errorCode: 'SCORE_CEILING_EXCEEDED',
      errorMessage: 'Skor melebihi batas absolut sistem.',
      anomalyReport: {
        detected: true,
        severity: 'CRITICAL',
        reason: `Score ${score} exceeded global ceiling of 10,000,000`,
        durationMs: verifiedDurationMs,
        scoreVelocity: 0
      },
      scoreVelocity: 0,
      verifiedDurationMs
    };
  }

  const durationSec = Math.max(verifiedDurationMs / 1000, 0.5);
  const scoreVelocity = score / durationSec;

  // 2. Layer 2: Hard Score Ceiling Check
  if (policy.enforceScoreCeiling && score > config.maxScoreCeiling) {
    return {
      valid: false,
      errorCode: 'SCORE_CEILING_EXCEEDED',
      errorMessage: 'Skor melebihi batas maksimum permainan.',
      anomalyReport: {
        detected: true,
        severity: 'CRITICAL',
        reason: `Score ${score} exceeded hard ceiling ${config.maxScoreCeiling}`,
        durationMs: verifiedDurationMs,
        scoreVelocity
      },
      scoreVelocity,
      verifiedDurationMs
    };
  }

  // 3. Layer 3: Temporal Duration Check
  if (policy.enforceDuration && score > 0 && verifiedDurationMs < config.minDurationMs) {
    return {
      valid: false,
      errorCode: 'INSUFFICIENT_DURATION',
      errorMessage: 'Durasi permainan terlalu singkat untuk memperoleh skor ini.',
      anomalyReport: {
        detected: true,
        severity: 'HIGH',
        reason: `Duration ${verifiedDurationMs}ms below min ${config.minDurationMs}ms`,
        durationMs: verifiedDurationMs,
        scoreVelocity
      },
      scoreVelocity,
      verifiedDurationMs
    };
  }

  // 4. Layer 4: Velocity Validation
  const maxAllowedVelocity = config.maxScorePerSec * policy.maxVelocityMargin;
  if (policy.enforceVelocity && score > 50 && scoreVelocity > maxAllowedVelocity) {
    return {
      valid: false,
      errorCode: 'SCORE_CEILING_EXCEEDED',
      errorMessage: 'Laju perolehan skor melebihi batas wajar.',
      anomalyReport: {
        detected: true,
        severity: 'HIGH',
        reason: `Velocity ${scoreVelocity.toFixed(1)}/s exceeded limit ${maxAllowedVelocity.toFixed(1)}/s`,
        durationMs: verifiedDurationMs,
        scoreVelocity
      },
      scoreVelocity,
      verifiedDurationMs
    };
  }

  // 5. Layer 5: Ranked Input Telemetry Plausibility
  if (policy.enforceInputTelemetry && inputTelemetry) {
    // If score is significant but zero actions were recorded
    if (score > 100 && inputTelemetry.inputCount === 0) {
      return {
        valid: false,
        errorCode: 'SCORE_CEILING_EXCEEDED',
        errorMessage: 'Anomali input permainan terdeteksi pada mode kompetitif.',
        anomalyReport: {
          detected: true,
          severity: 'HIGH',
          reason: `Zero inputs recorded for score ${score}`,
          durationMs: verifiedDurationMs,
          scoreVelocity
        },
        scoreVelocity,
        verifiedDurationMs
      };
    }

    // Input burst check: human maximum tap/key frequency ~ 30-40 Hz
    if (inputTelemetry.inputCount && (inputTelemetry.inputCount / durationSec) > 100) {
      return {
        valid: true, // Flag as warning anomaly without instant rejection
        anomalyReport: {
          detected: true,
          severity: 'MEDIUM',
          reason: `Suspiciously high input rate: ${(inputTelemetry.inputCount / durationSec).toFixed(1)} inputs/sec`,
          durationMs: verifiedDurationMs,
          scoreVelocity,
          details: { inputCount: inputTelemetry.inputCount }
        },
        scoreVelocity,
        verifiedDurationMs
      };
    }
  }

  return {
    valid: true,
    scoreVelocity,
    verifiedDurationMs
  };
}
