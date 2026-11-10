import { sha256HexSync } from '../../utils/sessionCrypto';

const BACKUP_INTEGRITY_SECRET = 'zigame_backup_integrity_v2_salt_8a3f';

function computeLegacySignature(serialized: string): string {
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  return `SIG-${Math.abs(hash).toString(16).toUpperCase()}`;
}

function computeStrongSignature(serialized: string): string {
  const digest = sha256HexSync(`${BACKUP_INTEGRITY_SECRET}|${serialized}`);
  return `SIGV2-${digest.slice(0, 32).toUpperCase()}`;
}

export const generateBackupString = (accountData: any): string => {
  const dataToSign = {
    username: accountData.username,
    displayName: accountData.displayName,
    password: accountData.password,
    profile: accountData.profile,
    games: accountData.games,
    achievements: accountData.achievements,
    timestamp: Date.now()
  };

  const serialized = JSON.stringify(dataToSign);
  const signature = computeStrongSignature(serialized);
  return JSON.stringify({ data: dataToSign, signature });
};

export const verifyAndImportBackup = (jsonString: string): any => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data || !parsed.signature || typeof parsed.signature !== 'string') {
      throw new Error("Format cadangan tidak valid.");
    }

    const serialized = JSON.stringify(parsed.data);
    const isV2 = parsed.signature.startsWith('SIGV2-');
    const expectedSignature = isV2
      ? computeStrongSignature(serialized)
      : computeLegacySignature(serialized);

    if (parsed.signature !== expectedSignature) {
      throw new Error("INTEGRITAS RUSAK: Terdapat manipulasi data cadangan atau kode tidak cocok!");
    }

    return parsed.data;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal mengurai berkas cadangan.";
    throw new Error(msg, { cause: e });
  }
};

