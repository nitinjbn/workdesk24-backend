import { CookieOptions } from 'express';

const DEFAULT_ACCESS_COOKIE_NAME = 'wd24_admin_access_token';
const DEFAULT_REFRESH_COOKIE_NAME = 'wd24_admin_refresh_token';
const DEFAULT_CSRF_COOKIE_NAME = 'wd24_admin_csrf';
const DEFAULT_ACCESS_COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const DEFAULT_REFRESH_COOKIE_MAX_AGE_MS = 30 * 24 * 60 * 60 * 1000;

type SameSite = CookieOptions['sameSite'];

const parseSameSite = (value: string | undefined): SameSite => {
  if (!value) {
    return 'lax';
  }

  const normalized = value.trim().toLowerCase();
  if (normalized === 'strict') {
    return 'strict';
  }
  if (normalized === 'none') {
    return 'none';
  }

  return 'lax';
};

const parseMaxAgeMsWithDefault = (value: string | undefined, defaultValue: number): number => {
  if (!value) {
    return defaultValue;
  }

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return defaultValue;
  }

  return parsed;
};

const shouldUseSecureCookie = (): boolean => {
  const forceSecure = process.env.ADMIN_AUTH_COOKIE_SECURE?.trim().toLowerCase();
  if (forceSecure === 'true') {
    return true;
  }
  if (forceSecure === 'false') {
    return false;
  }

  return process.env.NODE_ENV === 'production';
};

export const getAdminAuthCookieName = (): string => {
  return process.env.ADMIN_AUTH_COOKIE_NAME?.trim() || DEFAULT_ACCESS_COOKIE_NAME;
};

export const getAdminRefreshCookieName = (): string => {
  return process.env.ADMIN_REFRESH_COOKIE_NAME?.trim() || DEFAULT_REFRESH_COOKIE_NAME;
};

export const getAdminCsrfCookieName = (): string => {
  return process.env.ADMIN_CSRF_COOKIE_NAME?.trim() || DEFAULT_CSRF_COOKIE_NAME;
};

export const getAdminAuthCookieOptions = (): CookieOptions => {
  const secure = shouldUseSecureCookie();
  const sameSite = parseSameSite(process.env.ADMIN_AUTH_COOKIE_SAME_SITE);

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/v1/admin',
    maxAge: parseMaxAgeMsWithDefault(process.env.ADMIN_AUTH_COOKIE_MAX_AGE_MS, DEFAULT_ACCESS_COOKIE_MAX_AGE_MS),
  };
};

export const getAdminRefreshCookieOptions = (): CookieOptions => {
  const secure = shouldUseSecureCookie();
  const sameSite = parseSameSite(process.env.ADMIN_AUTH_COOKIE_SAME_SITE);

  return {
    httpOnly: true,
    secure,
    sameSite,
    path: '/api/v1/admin',
    maxAge: parseMaxAgeMsWithDefault(process.env.ADMIN_REFRESH_COOKIE_MAX_AGE_MS, DEFAULT_REFRESH_COOKIE_MAX_AGE_MS),
  };
};

export const getAdminCsrfCookieOptions = (): CookieOptions => {
  const secure = shouldUseSecureCookie();
  const sameSite = parseSameSite(process.env.ADMIN_AUTH_COOKIE_SAME_SITE);

  return {
    httpOnly: false,
    secure,
    sameSite,
    path: '/api/v1/admin',
    maxAge: parseMaxAgeMsWithDefault(process.env.ADMIN_REFRESH_COOKIE_MAX_AGE_MS, DEFAULT_REFRESH_COOKIE_MAX_AGE_MS),
  };
};

export const getAdminAuthClearCookieOptions = (): CookieOptions => {
  const options = getAdminAuthCookieOptions();
  return {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  };
};

export const getAdminRefreshClearCookieOptions = (): CookieOptions => {
  const options = getAdminRefreshCookieOptions();
  return {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  };
};

export const getAdminCsrfClearCookieOptions = (): CookieOptions => {
  const options = getAdminCsrfCookieOptions();
  return {
    httpOnly: options.httpOnly,
    secure: options.secure,
    sameSite: options.sameSite,
    path: options.path,
  };
};