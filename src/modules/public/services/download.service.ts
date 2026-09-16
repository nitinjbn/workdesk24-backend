import fs from 'fs';
import path from 'path';

export interface AndroidApkFile {
  fileName: string;
  filePath: string;
  size: number;
}

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

export const createAndroidApkReadStream = (filePath: string, start?: number, end?: number) =>
  fs.createReadStream(filePath, { start, end });
