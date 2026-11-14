import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { initializeFirestore, getFirestore, setLogLevel, doc, getDoc, getDocFromServer, setDoc, updateDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';

export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId: string | undefined;
    email: string | null | undefined;
    emailVerified: boolean | undefined;
    isAnonymous: boolean | undefined;
    tenantId: string | null | undefined;
    providerInfo: {
      providerId: string;
      displayName: string | null;
      email: string | null;
      photoUrl: string | null;
    }[];
  };
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null): FirestoreErrorInfo {
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
    authInfo: {
      userId: auth?.currentUser?.uid,
      email: auth?.currentUser?.email,
      emailVerified: auth?.currentUser?.emailVerified,
      isAnonymous: auth?.currentUser?.isAnonymous,
      tenantId: auth?.currentUser?.tenantId,
      providerInfo: auth?.currentUser?.providerData?.map((p: any) => ({
        providerId: p.providerId,
        displayName: p.displayName,
        email: p.email,
        photoUrl: p.photoURL
      })) || []
    },
    operationType,
    path
  };
  logger.error('Firestore Error', { context: { details: JSON.stringify(errInfo) } });
  if (errInfo.error.includes('Missing or insufficient permissions') && !import.meta.env.VITEST && import.meta.env.MODE !== 'test') {
    throw new Error(JSON.stringify(errInfo));
  }
  return errInfo;
}

interface AppletFirebaseConfig {
  apiKey?: string;
  authDomain?: string;
  projectId?: string;
  storageBucket?: string;
  messagingSenderId?: string;
  appId?: string;
  firestoreDatabaseId?: string;
}

function loadDevFallbackConfig(): AppletFirebaseConfig {
  if (!import.meta.env.DEV) {
    return {};
  }
  try {
    const modules = import.meta.glob('../../firebase-applet-config.json', { eager: true });
    const mod = modules['../../firebase-applet-config.json'] as
      | ({ default?: AppletFirebaseConfig } & AppletFirebaseConfig)
      | undefined;
    const raw: AppletFirebaseConfig = (mod && 'default' in mod && mod.default ? mod.default : mod) || {};
    if (raw.projectId?.includes('YOUR_FIREBASE_PROJECT_ID') || raw.apiKey?.includes('YOUR_API_KEY')) {
      return {};
    }
    return raw;
  } catch {
    return {};
  }
}

const devFallbackConfig = loadDevFallbackConfig();

// Configuration priority: VITE_FIREBASE_* env vars first, with dev-only fallback to gitignored local config
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || devFallbackConfig.apiKey || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || devFallbackConfig.authDomain || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || devFallbackConfig.projectId || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || devFallbackConfig.storageBucket || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || devFallbackConfig.messagingSenderId || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || devFallbackConfig.appId || '',
  firestoreDatabaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID || devFallbackConfig.firestoreDatabaseId || '(default)'
};

let app: any;
let auth: any = null;
let db: any = null;
let provider: any = null;
let isInitialized = false;
let initErrorMessage: string | null = null;

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Initialize Firestore with specific database ID and experimentalAutoDetectLongPolling for cloud/sandbox resilience
    try {
      const firestoreSettings = {
        experimentalAutoDetectLongPolling: true,
        ignoreUndefinedProperties: true
      };
      db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? initializeFirestore(app, firestoreSettings, firebaseConfig.firestoreDatabaseId)
        : initializeFirestore(app, firestoreSettings);
    } catch {
      db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
        ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
        : getFirestore(app);
    }
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    isInitialized = true;

    if (typeof window !== 'undefined' && !import.meta.env.VITEST && import.meta.env.MODE !== 'test') {
      getDocFromServer(doc(db, 'test', 'connection')).catch((err) => {
        if (err instanceof Error && err.message.includes('the client is offline')) {
          logger.warn('Please check your Firebase configuration. The client is offline.');
        }
      });
    }
  } else {
    initErrorMessage = 'Firebase client configuration missing. Set VITE_FIREBASE_API_KEY and VITE_FIREBASE_PROJECT_ID (or provide firebase-applet-config.json in development). Cloud sync & ranked login are disabled; Offline Guest Mode remains available.';
    if (!import.meta.env.VITEST && import.meta.env.MODE !== 'test') {
      logger.error(initErrorMessage);
    }
  }
} catch (e) {
  initErrorMessage = e instanceof Error ? e.message : String(e);
  logger.warn('Firebase not fully configured or failed to initialize', { error: e as Error });
}

export const isFirebaseReady = () => isInitialized;
export const getFirebaseInitError = () => initErrorMessage;

export { app, auth, db, provider, signInWithPopup, fbSignOut, onAuthStateChanged, doc, getDoc, getDocFromServer, setDoc, updateDoc };
export type { User };
