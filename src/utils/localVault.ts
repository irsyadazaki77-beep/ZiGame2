import { sha256HexSync } from './sessionCrypto';

const VAULT_SECRET = 'ZIGAME_LOCAL_VAULT_KEY_V2_9F8E7D6C5B4A';
const SEAL_PREFIX = 'zigame_vault_seal_';
const TAMPER_COUNT_KEY = 'zigame_vault_tamper_count';

export interface VaultEnvelope {
  __zv: 2;
  key: string;
  cipher: string;
  sig: string;
  ts: number;
}

export interface VaultIntegrityReport {
  isIntact: boolean;
  encryptedKeysCount: number;
  tamperedKeys: string[];
  tamperAttemptsCount: number;
  checkedAt: number;
}

function deriveKeyStream(storageKey: string, length: number): Uint8Array {
  const out = new Uint8Array(length);
  let offset = 0;
  let blockIndex = 0;
  while (offset < length) {
    const blockHex = sha256HexSync(`${VAULT_SECRET}:stream:${storageKey}:${blockIndex}`);
    for (let i = 0; i < blockHex.length && offset < length; i += 2) {
      out[offset++] = parseInt(blockHex.slice(i, i + 2), 16);
    }
    blockIndex++;
  }
  return out;
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return typeof btoa === 'function'
    ? btoa(binary)
    : Buffer.from(bytes).toString('base64');
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = typeof atob === 'function'
    ? atob(b64)
    : Buffer.from(b64, 'base64').toString('binary');
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

/**
 * Encrypts a UTF-8 JSON string using a deterministic SHA-256 keystream XOR cipher
 * and returns a base64 ciphertext string.
 */
export function encryptVaultPayload(storageKey: string, plainJson: string): string {
  const encoder = new TextEncoder();
  const plainBytes = encoder.encode(plainJson);
  const keyStream = deriveKeyStream(storageKey, plainBytes.length);
  const cipherBytes = new Uint8Array(plainBytes.length);
  for (let i = 0; i < plainBytes.length; i++) {
    cipherBytes[i] = plainBytes[i] ^ keyStream[i];
  }
  return bytesToBase64(cipherBytes);
}

/**
 * Decrypts a base64 ciphertext string back to a UTF-8 JSON string.
 */
export function decryptVaultPayload(storageKey: string, cipherBase64: string): string {
  const cipherBytes = base64ToBytes(cipherBase64);
  const keyStream = deriveKeyStream(storageKey, cipherBytes.length);
  const plainBytes = new Uint8Array(cipherBytes.length);
  for (let i = 0; i < cipherBytes.length; i++) {
    plainBytes[i] = cipherBytes[i] ^ keyStream[i];
  }
  const decoder = new TextDecoder();
  return decoder.decode(plainBytes);
}

/**
 * Computes a SHA-256 integrity MAC over the storage key and plaintext JSON.
 */
export function computeVaultSignature(storageKey: string, plainJson: string): string {
  return sha256HexSync(`${VAULT_SECRET}:mac:${storageKey}:${plainJson}`);
}

/**
 * Constant-time string comparison to prevent timing side-channels.
 */
function constantTimeEqual(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  let diff = 0;
  for (let i = 0; i < a.length; i++) {
    diff |= a.charCodeAt(i) ^ b.charCodeAt(i);
  }
  return diff === 0;
}

function recordTamperAttempt(storageKey: string): void {
  try {
    const current = parseInt(localStorage.getItem(TAMPER_COUNT_KEY) || '0', 10);
    localStorage.setItem(TAMPER_COUNT_KEY, String(current + 1));
    localStorage.removeItem(`${SEAL_PREFIX}${storageKey}`);
    localStorage.removeItem(storageKey);
    if (typeof window !== 'undefined' && typeof window.dispatchEvent === 'function') {
      window.dispatchEvent(
        new CustomEvent('zigame-storage-tampered', {
          detail: { key: storageKey, timestamp: Date.now() }
        })
      );
    }
  } catch {
    // Ignore storage quota errors
  }
}

export function getTamperAttemptsCount(): number {
  try {
    return parseInt(localStorage.getItem(TAMPER_COUNT_KEY) || '0', 10) || 0;
  } catch {
    return 0;
  }
}

/**
 * Seals and writes a value to localStorage inside an encrypted, SHA-256 signed VaultEnvelope.
 */
export function writeSignedVaultItem<T>(storageKey: string, value: T): void {
  const plainJson = JSON.stringify(value);
  const cipher = encryptVaultPayload(storageKey, plainJson);
  const sig = computeVaultSignature(storageKey, plainJson);
  const envelope: VaultEnvelope = {
    __zv: 2,
    key: storageKey,
    cipher,
    sig,
    ts: Date.now()
  };
  localStorage.setItem(storageKey, JSON.stringify(envelope));
  localStorage.setItem(`${SEAL_PREFIX}${storageKey}`, sig);
}

/**
 * Reads and verifies an item from localStorage.
 * - If stored as a VaultEnvelope (__zv === 2), decrypts and verifies its SHA-256 signature.
 * - If signature or key mismatches, or if a sealed key was downgraded to raw JSON in DevTools,
 *   flags tampering, wipes the forged value, and returns null.
 * - If no seal exists and raw JSON is present (e.g., initial migration or legacy data),
 *   parses normally so backward compatibility is preserved.
 */
export function readSignedVaultItem<T>(storageKey: string): T | null {
  const raw = localStorage.getItem(storageKey);
  if (!raw) return null;

  const expectedSeal = localStorage.getItem(`${SEAL_PREFIX}${storageKey}`);
  const parsed = JSON.parse(raw);

  if (parsed && typeof parsed === 'object' && parsed.__zv === 2) {
    const env = parsed as VaultEnvelope;
    if (env.key !== storageKey || typeof env.cipher !== 'string' || typeof env.sig !== 'string') {
      recordTamperAttempt(storageKey);
      throw new Error(`Storage vault envelope structure invalid for ${storageKey}`);
    }

    if (expectedSeal && !constantTimeEqual(expectedSeal, env.sig)) {
      recordTamperAttempt(storageKey);
      throw new Error(`Storage vault seal mismatch for ${storageKey}`);
    }

    let decryptedJson: string;
    try {
      decryptedJson = decryptVaultPayload(storageKey, env.cipher);
    } catch {
      recordTamperAttempt(storageKey);
      throw new Error(`Storage vault decryption failed for ${storageKey}`);
    }

    const computedSig = computeVaultSignature(storageKey, decryptedJson);
    if (!constantTimeEqual(computedSig, env.sig)) {
      recordTamperAttempt(storageKey);
      throw new Error(`Storage vault signature verification failed for ${storageKey}`);
    }

    return JSON.parse(decryptedJson) as T;
  }

  // Raw JSON found in localStorage: check if this key was previously sealed!
  // If a seal exists, someone overwrote the encrypted envelope in DevTools with plain JSON.
  if (expectedSeal) {
    recordTamperAttempt(storageKey);
    throw new Error(`Storage vault downgrade tampering detected on ${storageKey}`);
  }

  return parsed as T;
}

/**
 * Audits a list of sensitive storage keys and returns an integrity report.
 * Also upgrades any unsealed legacy JSON items into encrypted VaultEnvelopes.
 */
export function auditAndSealVaultKeys(keys: string[]): VaultIntegrityReport {
  let encryptedKeysCount = 0;
  const tamperedKeys: string[] = [];

  for (const key of keys) {
    const raw = localStorage.getItem(key);
    if (!raw) continue;

    try {
      const val = readSignedVaultItem<unknown>(key);
      if (val !== null) {
        // Ensure it is sealed in v2 format
        const parsedRaw = JSON.parse(raw);
        if (!parsedRaw || parsedRaw.__zv !== 2) {
          writeSignedVaultItem(key, val);
        }
        encryptedKeysCount++;
      }
    } catch {
      tamperedKeys.push(key);
    }
  }

  return {
    isIntact: tamperedKeys.length === 0,
    encryptedKeysCount,
    tamperedKeys,
    tamperAttemptsCount: getTamperAttemptsCount(),
    checkedAt: Date.now()
  };
}
