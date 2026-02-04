import admin from 'firebase-admin';

let firebaseApp = null;
let firestore = null;

function getFirebaseConfigFromEnv() {
  const projectId = process.env.FIREBASE_PROJECT_ID || process.env.GOOGLE_CLOUD_PROJECT || '';
  const clientEmail = process.env.FIREBASE_CLIENT_EMAIL || '';
  const privateKey = process.env.FIREBASE_PRIVATE_KEY
    ? process.env.FIREBASE_PRIVATE_KEY.replace(/\\n/g, '\n')
    : '';
  const databaseURL = process.env.FIREBASE_DATABASE_URL || process.env.FIREBASE_DB_URL || undefined;

  return {
    projectId,
    clientEmail,
    privateKey,
    databaseURL
  };
}

function isFirebaseConfigured() {
  const { projectId, clientEmail, privateKey } = getFirebaseConfigFromEnv();
  return Boolean(projectId && clientEmail && privateKey);
}

export function initialiseFirebase() {
  const config = getFirebaseConfigFromEnv();
  if (firebaseApp || !isFirebaseConfigured()) {
    return { app: firebaseApp, firestore, configured: Boolean(firebaseApp) };
  }

  firebaseApp = admin.initializeApp({
    credential: admin.credential.cert({
      projectId: config.projectId,
      clientEmail: config.clientEmail,
      privateKey: config.privateKey
    }),
    databaseURL: config.databaseURL
  });

  firestore = admin.firestore();

  return { app: firebaseApp, firestore, configured: Boolean(firebaseApp) };
}

export function getFirestore() {
  if (!firebaseApp) {
    initialiseFirebase();
  }
  return firestore;
}

export function getFirebaseStatus() {
  const { projectId } = getFirebaseConfigFromEnv();
  return {
    configured: isFirebaseConfigured(),
    initialised: Boolean(firebaseApp),
    projectId: projectId || null
  };
}

export const firebaseFieldValue = admin.firestore.FieldValue;
