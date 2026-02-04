import type { FirebaseApp, FirebaseOptions } from 'firebase/app';
import { getApp, getApps, initializeApp } from 'firebase/app';
import type { Analytics } from 'firebase/analytics';
import { getAnalytics, isSupported } from 'firebase/analytics';

const firebaseConfig: FirebaseOptions = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
  measurementId: import.meta.env.VITE_FIREBASE_MEASUREMENT_ID
};

type RequiredFirebaseConfigKeys = 'apiKey' | 'appId' | 'projectId';

const hasFirebaseConfig = (['apiKey', 'appId', 'projectId'] as RequiredFirebaseConfigKeys[]).every((key) => {
  const value = firebaseConfig[key];
  return typeof value === 'string' && value.length > 0;
});

let firebaseApp: FirebaseApp | null = null;
let analyticsPromise: Promise<Analytics | null> | null = null;

export function ensureFirebaseApp(): FirebaseApp | null {
  if (!hasFirebaseConfig) {
    if (import.meta.env.DEV) {
      console.warn('Firebase config is incomplete; skipping client SDK initialisation.');
    }
    return null;
  }

  if (firebaseApp) {
    return firebaseApp;
  }

  firebaseApp = getApps().length ? getApp() : initializeApp(firebaseConfig);
  return firebaseApp;
}

export async function getFirebaseAnalytics(): Promise<Analytics | null> {
  if (analyticsPromise) {
    return analyticsPromise;
  }

  analyticsPromise = (async () => {
    const app = ensureFirebaseApp();
    if (!app || typeof window === 'undefined' || !firebaseConfig.measurementId) {
      return null;
    }

    try {
      const supported = await isSupported();
      return supported ? getAnalytics(app) : null;
    } catch (error) {
      if (import.meta.env.DEV) {
        console.warn('Firebase analytics not available in this environment.', error);
      }
      return null;
    }
  })();

  return analyticsPromise;
}

export function isFirebaseClientConfigured() {
  return hasFirebaseConfig;
}
