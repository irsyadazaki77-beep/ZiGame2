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
  let hash = 0;
  for (let i = 0; i < serialized.length; i++) {
    const char = serialized.charCodeAt(i);
    hash = ((hash << 5) - hash) + char;
    hash = hash & hash;
  }
  const signature = `SIG-${Math.abs(hash).toString(16).toUpperCase()}`;
  return JSON.stringify({ data: dataToSign, signature });
};

export const verifyAndImportBackup = (jsonString: string): any => {
  try {
    const parsed = JSON.parse(jsonString);
    if (!parsed.data || !parsed.signature) {
      throw new Error("Format cadangan tidak valid.");
    }
    
    const serialized = JSON.stringify(parsed.data);
    let hash = 0;
    for (let i = 0; i < serialized.length; i++) {
      const char = serialized.charCodeAt(i);
      hash = ((hash << 5) - hash) + char;
      hash = hash & hash;
    }
    const expectedSignature = `SIG-${Math.abs(hash).toString(16).toUpperCase()}`;
    
    if (parsed.signature !== expectedSignature) {
      throw new Error("INTEGRITAS RUSAK: Terdapat manipulasi data cadangan atau kode tidak cocok!");
    }
    
    return parsed.data;
  } catch (e: unknown) {
    const msg = e instanceof Error ? e.message : "Gagal mengurai berkas cadangan.";
    throw new Error(msg, { cause: e });
  }
};
