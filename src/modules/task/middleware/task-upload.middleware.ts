import { ErrorRequestHandler } from 'express';
import multer from 'multer';

export const taskUpload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 10 * 1024 * 1024, files: 1 },
});

export const taskUploadErrorHandler: ErrorRequestHandler = (error, _req, res, next) => {
  if (error instanceof multer.MulterError) {
    res.status(400).json({
      success: false,
      code: 'INVALID_TASK_ATTACHMENT',
      message: error.code === 'LIMIT_FILE_SIZE' ? 'Attachments must not exceed 10 MB' : 'Invalid attachment upload',
    });
    return;
  }
  next(error);
};