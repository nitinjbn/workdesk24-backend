import { NextFunction, Request, Response } from 'express';
import { pipeline } from 'stream';
import { createAndroidApkReadStream, getAndroidApkFile } from '../services/download.service';

export const downloadAndroidApk = (req: Request, res: Response, next: NextFunction): void => {
  try {
    const apkFile = getAndroidApkFile();
    const ranges = req.range(apkFile.size, { combine: true });

    res.attachment(apkFile.fileName);
    res.type('application/vnd.android.package-archive');
    res.setHeader('Accept-Ranges', 'bytes');
    res.setHeader('Cache-Control', 'no-cache');

    if (ranges === -1) {
      res.setHeader('Content-Range', `bytes */${apkFile.size}`);
      res.status(416).end();
      return;
    }

    if (ranges === -2 || (Array.isArray(ranges) && ranges.length !== 1)) {
      res.status(400).end();
      return;
    }

    const range = Array.isArray(ranges) ? ranges[0] : undefined;
    const start = range?.start;
    const end = range?.end;
    const contentLength = range ? end! - start! + 1 : apkFile.size;

    if (range) {
      res.status(206);
      res.setHeader('Content-Range', `bytes ${start}-${end}/${apkFile.size}`);
    }

    res.setHeader('Content-Length', contentLength.toString());

    if (req.method === 'HEAD') {
      res.end();
      return;
    }

    const apkStream = createAndroidApkReadStream(apkFile.filePath, start, end);
    pipeline(apkStream, res, (error) => {
      if (!error || res.destroyed) {
        return;
      }

      if (res.headersSent) {
        res.destroy(error);
        return;
      }
      next(error);
    });
  } catch (error: unknown) {
    const downloadError = error as NodeJS.ErrnoException;
    if (downloadError.code === 'ENOENT') {
      res.status(404).json({
        success: false,
        message: 'Android APK not found',
      });
      return;
    }

    next(error);
  }
};
