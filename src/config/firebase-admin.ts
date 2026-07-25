import fs from 'fs';
import path from 'path';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { CONFIG } from './constants';
import dotenv from 'dotenv';

// Load environment variables from .env file
dotenv.config();

const resolveServiceAccountPath = (): string => {
  if (CONFIG.NOTIFICATIONS.PUSH.FIREBASE.SERVICE_ACCOUNT_PATH) {
    return path.resolve(CONFIG.NOTIFICATIONS.PUSH.FIREBASE.SERVICE_ACCOUNT_PATH);
  }

  return path.resolve(
    process.cwd(),
    process.env.FIREBASE_SERVICE_ACCOUNT_PATH || process.env.FIREBASE_SERVICE_ACCOUNT || 'firebase-service-account.json'
  );
};

const loadServiceAccount = (): { projectId: string; clientEmail: string; privateKey: string } => {
//   const serviceAccountPath = resolveServiceAccountPath();

//   if (!fs.existsSync(serviceAccountPath)) {
//     throw new Error(`Firebase service account file not found at: ${serviceAccountPath}`);
//   }

  const raw = process.env.FIREBASE_SERVICE_ACCOUNT || fs.readFileSync(process.env.FIREBASE_SERVICE_ACCOUNT_KEY_PATH, 'utf-8');
  // console.log('Loaded Firebase service account from environment variable or file path.', raw);
  return JSON.parse(raw) as { projectId: string; clientEmail: string; privateKey: string };
};

const getFirebaseApp = (): App => {
  const apps = getApps();
  if (apps.length > 0) {
    return apps[0];
  }

  const serviceAccount = loadServiceAccount();

  return initializeApp({
    credential: cert(serviceAccount),
  });
};

export const getFirebaseMessaging = (): Messaging => {
  return getMessaging(getFirebaseApp());
};
