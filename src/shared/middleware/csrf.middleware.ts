import { Response, NextFunction } from 'express';
import crypto from 'crypto';
import { AuthRequest } from '../types/auth.types';
import { getAdminCsrfCookieName } from '../utils/auth-cookie.util';

const safeEqual = (a: string, b: string): boolean => {
  const aBuffer = Buffer.from(a, 'utf8');
  const bBuffer = Buffer.from(b, 'utf8');

  if (aBuffer.length !== bBuffer.length) {
    return false;
  }

  return crypto.timingSafeEqual(aBuffer, bBuffer);
};

export const requireAdminCsrfToken = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const csrfCookieName = getAdminCsrfCookieName();
  const csrfCookieToken = req.cookies?.[csrfCookieName] as string | undefined;
  const csrfHeaderToken = req.headers['x-csrf-token'];
  const csrfToken = Array.isArray(csrfHeaderToken) ? csrfHeaderToken[0] : csrfHeaderToken;

  if (!csrfCookieToken || !csrfToken) {
    res.status(403).json({
      success: false,
      message: 'CSRF token is required',
    });
    return;
  }

  if (!safeEqual(csrfCookieToken, csrfToken)) {
    res.status(403).json({
      success: false,
      message: 'Invalid CSRF token',
    });
    return;
  }

  next();
};
