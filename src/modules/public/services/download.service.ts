import fs from 'fs';
import path from 'path';

// Get the full path to the Android APK file based on the configured environment variables
export const getAndroidApkPath = (): string => {
  const mountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/storage';

  const apkFileName = process.env.ANDROID_APK_FILE;

  if (!apkFileName) {
    throw new Error('ANDROID_APK_FILE is not configured');
  }

  return path.join(mountPath, 'apk', apkFileName);
};

export interface AndroidApkFile {
  fileName: string;
  filePath: string;
  size: number;
}

// Get detailed information about the Android APK file, including its path and size
export const getAndroidApkFile = (): AndroidApkFile => {
  const mountPath = process.env.RAILWAY_VOLUME_MOUNT_PATH || '/app/storage';
  const configuredFileName = process.env.ANDROID_APK_FILE;

  if (!configuredFileName) {
    throw new Error('ANDROID_APK_FILE is not configured');
  }

  const fileName = path.basename(configuredFileName);
  const filePath = path.join(mountPath, 'apk', fileName);
  const fileStats = fs.statSync(filePath);

  if (!fileStats.isFile()) {
    const error = new Error('Android APK not found') as NodeJS.ErrnoException;
    error.code = 'ENOENT';
    throw error;
  }

  return {
    fileName,
    filePath,
    size: fileStats.size,
  };
};

// Create a readable stream for the Android APK file, optionally specifying a byte range
export const createAndroidApkReadStream = (filePath: string, start?: number, end?: number) =>
  fs.createReadStream(filePath, { start, end });
