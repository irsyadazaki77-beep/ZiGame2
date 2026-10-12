import { initializeApp, getApps, getApp } from 'firebase/app';
import { getAuth, GoogleAuthProvider, signInWithPopup, signOut as fbSignOut, onAuthStateChanged, User } from 'firebase/auth';
import { getFirestore, doc, getDoc, setDoc, updateDoc } from 'firebase/firestore';
import { logger } from '../utils/logger';
import firebaseConfigJson from '../../firebase-applet-config.json';

// Configuration priority: firebase-applet-config.json with env var overrides
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || firebaseConfigJson.apiKey || "",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || firebaseConfigJson.authDomain || "",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || firebaseConfigJson.projectId || "",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || firebaseConfigJson.storageBucket || "",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || firebaseConfigJson.messagingSenderId || "",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || firebaseConfigJson.appId || "",
  firestoreDatabaseId: import.meta.env.VITE_FIRESTORE_DATABASE_ID || firebaseConfigJson.firestoreDatabaseId || "(default)"
};

let app: any;
let auth: any = null;
let db: any = null;
let provider: any = null;
let isInitialized = false;

try {
  if (firebaseConfig.apiKey && firebaseConfig.projectId) {
    app = getApps().length > 0 ? getApp() : initializeApp(firebaseConfig);
    auth = getAuth(app);
    // Initialize Firestore with specific database ID when configured
    db = firebaseConfig.firestoreDatabaseId && firebaseConfig.firestoreDatabaseId !== '(default)'
      ? getFirestore(app, firebaseConfig.firestoreDatabaseId)
      : getFirestore(app);
    provider = new GoogleAuthProvider();
    provider.setCustomParameters({ prompt: 'select_account' });
    isInitialized = true;
  }
} catch (e) {
  logger.warn("Firebase not fully configured or failed to initialize", { error: e as Error });
}

export const isFirebaseReady = () => isInitialized;

export { app, auth, db, provider, signInWithPopup, fbSignOut, onAuthStateChanged, doc, getDoc, setDoc, updateDoc };
export type { User };
