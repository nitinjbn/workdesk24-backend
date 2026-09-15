import { Request, Response } from 'express';
import { getAndroidApkPath } from '../services/download.service';

export const downloadAndroidApk = (req: Request, res: Response): void => {
  const apkPath = getAndroidApkPath();

  res.download(apkPath, process.env.ANDROID_APK_FILE, (error) => {
    if (error && !res.headersSent) {
      res.status(404).json({
        success: false,
        message: 'Android APK not found',
      });
    }
  });
};
