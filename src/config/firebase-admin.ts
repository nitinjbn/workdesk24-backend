import fs from 'fs';
import path from 'path';
import { App, cert, getApps, initializeApp } from 'firebase-admin/app';
import { getMessaging, Messaging } from 'firebase-admin/messaging';
import { CONFIG } from './constants';

const resolveServiceAccountPath = (): string => {
  if (CONFIG.NOTIFICATIONS.PUSH.FIREBASE.SERVICE_ACCOUNT_PATH) {
    return path.resolve(CONFIG.NOTIFICATIONS.PUSH.FIREBASE.SERVICE_ACCOUNT_PATH);
  }

  return path.resolve(
    process.cwd(),
    'src/config/workdesk24-8c49c-firebase-adminsdk-fbsvc-f98414a120.json'
  );
};

const loadServiceAccount = (): { projectId: string; clientEmail: string; privateKey: string } => {
  const serviceAccountPath = resolveServiceAccountPath();

  if (!fs.existsSync(serviceAccountPath)) {
    throw new Error(`Firebase service account file not found at: ${serviceAccountPath}`);
  }

  const raw = fs.readFileSync(serviceAccountPath, 'utf-8');
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
