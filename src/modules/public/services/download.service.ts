import fs from 'fs';
import path from 'path';

export const getAndroidApkPath = (): string => {
  const mountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/storage';

  const apkFileName = process.env.ANDROID_APK_FILE;

  if (!apkFileName) {
    throw new Error('ANDROID_APK_FILE is not configured');
  }

  return path.join(mountPath, 'apk', apkFileName);
};
