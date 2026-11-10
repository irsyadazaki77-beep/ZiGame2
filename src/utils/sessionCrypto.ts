/**
 * Client-Side Cryptographic Session & PIN Security Utilities
 * Generates SHA-256 integrity proofs for score sessions and salted hashes for local Session PINs.
 */

function fallbackSha256Hex(rawInput: string): string {
  function rightRotate(value: number, amount: number) {
    return (value >>> amount) | (value << (32 - amount));
  }

  const utf8Bytes = new TextEncoder().encode(rawInput);
  let ascii = '';
  for (let idx = 0; idx < utf8Bytes.length; idx++) {
    ascii += String.fromCharCode(utf8Bytes[idx]);
  }

  const mathPow = Math.pow;
  const maxWord = mathPow(2, 32);
  const lengthProperty = 'length';
  let i: number, j: number;
  let result = '';

  const words: number[] = [];
  const asciiBitLength = ascii[lengthProperty] * 8;

  let hash: number[] = [];
  const k: number[] = [];
  let primeCounter = 0;

  const isComposite: Record<number, number> = {};
  for (let candidate = 2; primeCounter < 64; candidate++) {
    if (!isComposite[candidate]) {
      for (i = 0; i < 313; i += candidate) {
        isComposite[i] = candidate;
      }
      hash[primeCounter] = (mathPow(candidate, 0.5) * maxWord) | 0;
      k[primeCounter++] = (mathPow(candidate, 1 / 3) * maxWord) | 0;
    }
  }

  ascii += '\x80';
  while ((ascii[lengthProperty] % 64) - 56) ascii += '\x00';
  for (i = 0; i < ascii[lengthProperty]; i++) {
    j = ascii.charCodeAt(i);
    if (j >> 8) return '';
    words[i >> 2] |= j << ((3 - (i % 4)) * 8);
  }
  words[words[lengthProperty]] = (asciiBitLength / maxWord) | 0;
  words[words[lengthProperty]] = asciiBitLength;

  for (j = 0; j < words[lengthProperty]; ) {
    const w = words.slice(j, (j += 16));
    const oldHash = hash;
    hash = hash.slice(0, 8);

    for (i = 0; i < 64; i++) {
      const i2 = i + j;
      const w15 = w[i - 15],
        w2 = w[i - 2];

      const a = hash[0],
        e = hash[4];
      const temp1 =
        hash[7] +
        (rightRotate(e, 6) ^ rightRotate(e, 11) ^ rightRotate(e, 25)) +
        ((e & hash[5]) ^ (~e & hash[6])) +
        k[i] +
        (w[i] =
          i < 16
            ? w[i]
            : (w[i - 16] +
                (rightRotate(w15, 7) ^ rightRotate(w15, 18) ^ (w15 >>> 3)) +
                w[i - 7] +
                (rightRotate(w2, 17) ^ rightRotate(w2, 19) ^ (w2 >>> 10))) |
              0);
      const temp2 =
        (rightRotate(a, 2) ^ rightRotate(a, 13) ^ rightRotate(a, 22)) +
        ((a & hash[1]) ^ (a & hash[2]) ^ (hash[1] & hash[2]));

      hash = [(temp1 + temp2) | 0].concat(hash);
      hash[4] = (hash[4] + temp1) | 0;
      void i2;
    }

    for (i = 0; i < 8; i++) {
      hash[i] = (hash[i] + oldHash[i]) | 0;
    }
  }

  for (i = 0; i < 8; i++) {
    for (j = 3; j + 1; j--) {
      const b = (hash[i] >> (j * 8)) & 255;
      result += (b < 16 ? 0 : '') + b.toString(16);
    }
  }
  return result;
}

export async function sha256Hex(message: string): Promise<string> {
  try {
    if (typeof globalThis !== 'undefined' && globalThis.crypto?.subtle) {
      const encoder = new TextEncoder();
      const data = encoder.encode(message);
      const digest = await globalThis.crypto.subtle.digest('SHA-256', data);
      return Array.from(new Uint8Array(digest))
        .map(b => b.toString(16).padStart(2, '0'))
        .join('');
    }
  } catch {
    // Fallback to pure JS SHA-256
  }
  return fallbackSha256Hex(message);
}

export function sha256HexSync(message: string): string {
  return fallbackSha256Hex(message);
}

/**
 * Computes deterministic SHA-256 payload integrity proof matching server verifier.
 */
export async function computePayloadProofClient(
  sessionId: string,
  gameId: string,
  score: number,
  nonce: string
): Promise<string> {
  const raw = `zigame_proof_v2|${sessionId}|${gameId}|${Math.floor(score)}|${nonce}`;
  return await sha256Hex(raw);
}

const PIN_SALT = 'zigame_local_pin_guard_v2_salt';

export function hashSecurityPinSync(pin: string): string {
  return sha256HexSync(`${PIN_SALT}:${pin.trim()}`);
}

export function verifySecurityPinSync(pin: string, storedHash: string): boolean {
  if (!pin || !storedHash) return false;
  return hashSecurityPinSync(pin) === storedHash;
}
