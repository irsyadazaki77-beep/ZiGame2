/**
 * Database Seed & Catalog Verification Utility
 * ZiGame 2.0 Hardened Operations
 * 
 * Usage:
 *   npx tsx scripts/seed-catalog.ts
 *   npx tsx scripts/seed-catalog.ts --force-prod (for production initialization)
 */

import fs from 'fs';
import { initializeApp, cert, getApps } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { SERVER_SHOP_CATALOG } from '../src/config/shopCatalog';
import firebaseAppletConfig from '../firebase-applet-config.json';

async function main() {
  console.log('🚀 ZiGame 2.0 Catalog Seeder starting...');

  // Production guard
  if (process.env.NODE_ENV === 'production' && !process.argv.includes('--force-prod')) {
    console.error('❌ Refusing to run in production without explicit --force-prod flag.');
    process.exit(1);
  }

  // Initialize Firebase Admin if credentials are present
  if (getApps().length === 0) {
    const gacPath = process.env.GOOGLE_APPLICATION_CREDENTIALS?.trim();
    const hasValidGac = Boolean(gacPath && fs.existsSync(gacPath));
    if (process.env.FIREBASE_SERVICE_ACCOUNT) {
      const sa = JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT);
      initializeApp({
        credential: cert(sa),
        projectId: sa.project_id || firebaseAppletConfig.projectId
      });
    } else if (hasValidGac) {
      initializeApp({
        projectId: process.env.FIREBASE_PROJECT_ID || firebaseAppletConfig.projectId
      });
    } else {
      console.log('ℹ️ No Firebase credentials detected. Operating in dry-run verification mode.');
      console.log(`✅ Authoritative Catalog verified with ${Object.keys(SERVER_SHOP_CATALOG).length} items:`);
      for (const [id, item] of Object.entries(SERVER_SHOP_CATALOG)) {
        console.log(`  - [${item.type.toUpperCase()}] ${id}: ${item.name} (${item.cost} coins)`);
      }
      return;
    }
  }

  const dbId = process.env.VITE_FIRESTORE_DATABASE_ID || firebaseAppletConfig.firestoreDatabaseId;
  const db = dbId && dbId !== '(default)'
    ? getFirestore(getApps()[0], dbId)
    : getFirestore();
  const batch = db.batch();
  let count = 0;

  for (const [id, item] of Object.entries(SERVER_SHOP_CATALOG)) {
    const docRef = db.collection('shopCatalog').doc(id);
    batch.set(docRef, {
      ...item,
      updatedAt: new Date().toISOString()
    }, { merge: true });
    count++;
  }

  await batch.commit();
  console.log(`✅ Successfully seeded/verified ${count} catalog items in Firestore.`);
}

main().catch((err) => {
  console.error('❌ Seeder encountered fatal error:', err);
  process.exit(1);
});
