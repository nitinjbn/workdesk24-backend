import { NextFunction, Request, Response } from 'express';
import { getAndroidApkPath } from '../services/download.service';

export const downloadAndroidApk = (_req: Request, res: Response, next: NextFunction): void => {
  try {
    const apkPath = getAndroidApkPath();
    const apkFileName = process.env.ANDROID_APK_FILE;

    res.setHeader('Content-Type', 'application/vnd.android.package-archive');
    res.setHeader('Cache-Control', 'no-store');

    res.download(apkPath, apkFileName, (error) => {
      if (!error) {
        return;
      }

      if (res.headersSent) {
        res.destroy(error);
        return;
      }

      const downloadError = error as NodeJS.ErrnoException;
      if (downloadError.code === 'ENOENT') {
        res.status(404).json({
          success: false,
          message: 'Android APK not found',
        });
        return;
      }

      next(error);
    });
  } catch (error: unknown) {
    next(error);
  }
};
