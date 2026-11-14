/**
 * Admin Custom Claims CLI Utility
 * Securely grants or revokes Firebase Auth Admin Custom Claims via Firebase Admin SDK.
 *
 * Usage:
 *   npx tsx scripts/set-admin-claim.ts --uid <firebase_uid>
 *   npx tsx scripts/set-admin-claim.ts --email <user_email>
 *   npx tsx scripts/set-admin-claim.ts --uid <firebase_uid> --revoke
 */

import fs from 'fs';
import path from 'path';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getAuth } from 'firebase-admin/auth';

function parseArgs(argv: string[]): { uid?: string; email?: string; revoke: boolean } {
  let uid: string | undefined;
  let email: string | undefined;
  let revoke = false;

  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (arg === '--uid' && argv[i + 1]) {
      uid = argv[++i].trim();
    } else if (arg.startsWith('--uid=')) {
      uid = arg.slice('--uid='.length).trim();
    } else if (arg === '--email' && argv[i + 1]) {
      email = argv[++i].trim();
    } else if (arg.startsWith('--email=')) {
      email = arg.slice('--email='.length).trim();
    } else if (arg === '--revoke') {
      revoke = true;
    }
  }

  return { uid, email, revoke };
}

function loadLocalProjectId(): string | undefined {
  if (process.env.FIREBASE_PROJECT_ID?.trim()) {
    return process.env.FIREBASE_PROJECT_ID.trim();
  }
  const configPath = path.resolve(process.cwd(), 'firebase-applet-config.json');
  if (fs.existsSync(configPath)) {
    try {
      const parsed = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
      if (parsed?.projectId && !String(parsed.projectId).includes('YOUR_FIREBASE_PROJECT_ID')) {
        return String(parsed.projectId);
      }
    } catch {
      // Ignore malformed local file
    }
  }
  return undefined;
}

function parseServiceAccount(raw: string | undefined): Record<string, any> | null {
  if (!raw?.trim()) return null;
  const trimmed = raw.trim();
  try {
    const parsed = JSON.parse(trimmed);
    if (parsed?.project_id) return parsed;
  } catch {}
  try {
    const decoded = Buffer.from(trimmed, 'base64').toString('utf-8');
    const parsed = JSON.parse(decoded);
    if (parsed?.project_id) return parsed;
  } catch {}
  return null;
}

async function main() {
  const { uid, email, revoke } = parseArgs(process.argv.slice(2));

  if (!uid && !email) {
    console.error('Usage: npx tsx scripts/set-admin-claim.ts (--uid <uid> | --email <email>) [--revoke]');
    process.exit(1);
  }

  const projectId = loadLocalProjectId();
  const serviceAccount = parseServiceAccount(process.env.FIREBASE_SERVICE_ACCOUNT);
  const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
  const hasValidGac = Boolean(gacPath && fs.existsSync(gacPath));

  if (getApps().length === 0) {
    if (serviceAccount) {
      initializeApp({
        credential: cert(serviceAccount),
        projectId: serviceAccount.project_id || projectId
      });
    } else if (hasValidGac || projectId) {
      initializeApp(projectId ? { projectId } : undefined);
    } else {
      console.error('❌ Missing Firebase Admin credentials (FIREBASE_SERVICE_ACCOUNT, GOOGLE_APPLICATION_CREDENTIALS, or FIREBASE_PROJECT_ID).');
      process.exit(1);
    }
  }

  const auth = getAuth();
  const userRecord = uid ? await auth.getUser(uid) : await auth.getUserByEmail(email!);
  const existingClaims = { ...(userRecord.customClaims || {}) };

  if (revoke) {
    delete existingClaims.admin;
    if (existingClaims.role === 'admin') {
      delete existingClaims.role;
    }
    await auth.setCustomUserClaims(userRecord.uid, existingClaims);
    console.log(`✅ Revoked admin custom claims for uid=${userRecord.uid} (${userRecord.email || 'no-email'}).`);
  } else {
    const nextClaims = {
      ...existingClaims,
      admin: true,
      role: 'admin'
    };
    await auth.setCustomUserClaims(userRecord.uid, nextClaims);
    console.log(`✅ Granted admin custom claims { admin: true, role: 'admin' } to uid=${userRecord.uid} (${userRecord.email || 'no-email'}).`);
    console.log('ℹ️ User must refresh their Firebase ID token (sign out/in or getIdToken(true)) for claims to take effect.');
  }
}

main().catch((err) => {
  console.error('❌ Failed to update admin custom claims:', err instanceof Error ? err.message : String(err));
  process.exit(1);
});
