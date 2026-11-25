import express, { ErrorRequestHandler, RequestHandler } from 'express';
import { logger } from '../../../config/database';
import { deviceHealthPath } from '../../../shared/utils/device-health-path.util';

export const requireDeviceHealthJson: RequestHandler = (req, res, next) => {
  if (req.method !== 'POST' || !deviceHealthPath.test(req.path)) {
    next();
    return;
  }
  if (!req.is('application/json')) {
    res.status(415).json({ success: false, code: 'DEVICE_HEALTH_CONTENT_TYPE', message: 'JSON body required', data: null });
    return;
  }
  express.json({ limit: '16kb' })(req, res, next);
};

export const handleDeviceHealthBodyError: ErrorRequestHandler = (error: unknown, req, res, next) => {
  if (req.method !== 'POST' || !deviceHealthPath.test(req.path)) {
    next(error);
    return;
  }
  const status = typeof error === 'object' && error !== null && 'status' in error
    ? error.status : undefined;
  const code = status === 413 ? 413 : status === 415 ? 415 : status === 400 ? 400 : 500;
  if (code === 500) logger.error('Device health request parsing failed');
  res.status(code).json({
    success: false,
    code: code === 413 ? 'DEVICE_HEALTH_BODY_TOO_LARGE' : code === 415
      ? 'DEVICE_HEALTH_CONTENT_TYPE' : code === 400 ? 'DEVICE_HEALTH_INVALID_JSON' : 'DEVICE_HEALTH_UNAVAILABLE',
    message: code === 413 ? 'Device health body too large' : code === 415
      ? 'Unsupported device health content' : code === 400 ? 'Invalid JSON body' : 'Device health synchronization temporarily unavailable',
    data: null,
  });
};
