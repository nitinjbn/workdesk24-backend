import type { ErrorRequestHandler, NextFunction, RequestHandler, Response } from 'express';
import { logger } from '../../../config/database';
import { apiLogService, ApiLogService } from '../services/api-log.service';
import type {
  ApiLogFinalizeInput,
  ApiLogSource,
  ApiLoggingLocals,
  ApiLoggingRequest,
  JsonObject,
  JsonValue,
} from '../types/api-log.types';

const SKIP_PATH_SUFFIXES = new Set(['/health', '/ping']);
const SKIP_EXACT_PATHS = new Set(['/favicon.ico']);
const DEFAULT_SKIP_PATH_PATTERNS = ['/background-jobs'];
const DEFAULT_MAX_BODY_BYTES = Number(process.env.API_LOG_BODY_MAX_BYTES ?? 32768);
const API_LOG_CREATE_TIMEOUT_MS = Number(process.env.API_LOG_CREATE_TIMEOUT_MS ?? 30);
const SKIP_PATH_PATTERNS = (() => {
  const configured = process.env.API_LOG_SKIP_PATH_PATTERNS?.trim();
  if (!configured) {
    return DEFAULT_SKIP_PATH_PATTERNS;
  }

  return configured
    .split(',')
    .map((pattern) => pattern.trim())
    .filter((pattern) => pattern.length > 0);
})();

const SENSITIVE_KEYS = new Set([
  'password',
  'otp',
  'pin',
  'authorization',
  'accesstoken',
  'refreshtoken',
  'token',
]);

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toNumber(value: unknown): number | undefined {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : undefined;
  }

  return undefined;
}

function toStringOrUndefined(value: unknown): string | undefined {
  if (typeof value === 'string' && value.trim() !== '') {
    return value.trim();
  }

  return undefined;
}

function normalizeSource(value: unknown): ApiLogSource {
  const normalized = toStringOrUndefined(value)?.toUpperCase();
  if (
    normalized === 'ANDROID' ||
    normalized === 'IOS' ||
    normalized === 'WEB' ||
    normalized === 'CRON' ||
    normalized === 'SYSTEM'
  ) {
    return normalized;
  }

  return 'WEB';
}

function inferSource(req: ApiLoggingRequest): ApiLogSource {
  const headerSource = req.headers['x-source'] ?? req.headers['x-client-source'];
  if (Array.isArray(headerSource)) {
    return normalizeSource(headerSource[0]);
  }

  if (typeof headerSource === 'string') {
    return normalizeSource(headerSource);
  }

  if (isPlainObject(req.body) && req.body.source !== undefined) {
    return normalizeSource(req.body.source);
  }

  const userAgent = toStringOrUndefined(req.headers['user-agent'])?.toLowerCase();
  if (userAgent?.includes('android')) {
    return 'ANDROID';
  }
  if (userAgent?.includes('iphone') || userAgent?.includes('ios')) {
    return 'IOS';
  }
  if (userAgent?.includes('cron')) {
    return 'CRON';
  }

  return 'WEB';
}

function maskSensitiveData(value: unknown, visited: WeakSet<object> = new WeakSet()): JsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (value instanceof Date) {
    return value.toISOString();
  }

  if (Buffer.isBuffer(value)) {
    return `[buffer:${value.length}]`;
  }

  if (Array.isArray(value)) {
    return value.map((item) => maskSensitiveData(item, visited));
  }

  if (!isPlainObject(value)) {
    return String(value);
  }

  if (visited.has(value)) {
    return '[circular]';
  }
  visited.add(value);

  const masked: JsonObject = {};
  for (const [key, childValue] of Object.entries(value)) {
    if (SENSITIVE_KEYS.has(key.toLowerCase())) {
      masked[key] = '[masked]';
      continue;
    }

    masked[key] = maskSensitiveData(childValue, visited);
  }

  return masked;
}

function jsonByteLength(value: unknown): number {
  const serialized = safeJsonStringify(value);
  return Buffer.byteLength(serialized, 'utf8');
}

function ensureSizeBound(value: JsonValue, maxBytes: number): JsonValue {
  const serialized = safeJsonStringify(value);
  const size = Buffer.byteLength(serialized, 'utf8');
  if (size <= maxBytes) {
    return value;
  }

  return {
    truncated: true,
    originalBytes: size,
    maxBytes,
    preview: serialized.slice(0, maxBytes),
  };
}

function safeJsonStringify(value: unknown): string {
  const visited = new WeakSet<object>();

  try {
    const serialized = JSON.stringify(value, (_key, currentValue) => {
      if (typeof currentValue === 'bigint') {
        return currentValue.toString();
      }

      if (typeof currentValue === 'object' && currentValue !== null) {
        if (visited.has(currentValue)) {
          return '[circular]';
        }
        visited.add(currentValue);
      }

      return currentValue;
    });

    return serialized ?? '';
  } catch {
    return '[unserializable]';
  }
}

async function withTimeout<T>(promise: Promise<T>, timeoutMs: number): Promise<T | null> {
  if (!Number.isFinite(timeoutMs) || timeoutMs <= 0) {
    return promise;
  }

  return Promise.race<T | null>([
    promise,
    new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), timeoutMs);
    }),
  ]);
}

function getRequestSize(req: ApiLoggingRequest, fallbackBody: JsonValue): number {
  const fromHeader = toNumber(req.headers['content-length']);
  if (fromHeader !== undefined) {
    return fromHeader;
  }

  return jsonByteLength(fallbackBody);
}

function getResponseSize(res: Response, fallbackBody: JsonValue | undefined): number | undefined {
  const headerValue = res.getHeader('content-length');
  const parsed = toNumber(Array.isArray(headerValue) ? headerValue[0] : headerValue);
  if (parsed !== undefined) {
    return parsed;
  }

  if (fallbackBody === undefined) {
    return undefined;
  }

  return jsonByteLength(fallbackBody);
}

function getEndpoint(req: ApiLoggingRequest): string {
  return req.originalUrl.split('?')[0] || req.path;
}

function shouldSkipPath(endpoint: string): boolean {
  if (SKIP_EXACT_PATHS.has(endpoint)) {
    return true;
  }

  for (const suffix of SKIP_PATH_SUFFIXES) {
    if (endpoint === suffix || endpoint.endsWith(suffix) || endpoint.includes(`${suffix}/`)) {
      return true;
    }
  }

  for (const pattern of SKIP_PATH_PATTERNS) {
    if (
      endpoint === pattern ||
      endpoint.startsWith(`${pattern}/`) ||
      endpoint.endsWith(pattern) ||
      endpoint.includes(`${pattern}/`)
    ) {
      return true;
    }
  }

  return false;
}

function getCategoryAndModule(endpoint: string): { category: string; module: string } {
  const segments = endpoint.split('/').filter((segment) => segment.length > 0);

  if (segments[0] === 'api' && segments[1]?.startsWith('v')) {
    return {
      category: segments[2] ?? 'unknown',
      module: segments[3] ?? 'root',
    };
  }

  return {
    category: segments[0] ?? 'unknown',
    module: segments[1] ?? 'root',
  };
}

function resolveCategoryAndModule(req: ApiLoggingRequest, endpoint: string): { category: string; module: string } {
  if (req.apiLogContext !== undefined) {
    return {
      category: req.apiLogContext.category,
      module: req.apiLogContext.module,
    };
  }

  return getCategoryAndModule(endpoint);
}

function getDurationMilliseconds(startTime: bigint): number {
  const elapsedNanos = process.hrtime.bigint() - startTime;
  return Number(elapsedNanos / 1000000n);
}

function resolveIpAddress(req: ApiLoggingRequest): string | undefined {
  const xForwardedFor = req.headers['x-forwarded-for'];
  if (typeof xForwardedFor === 'string' && xForwardedFor.trim() !== '') {
    return xForwardedFor.split(',')[0].trim();
  }

  if (Array.isArray(xForwardedFor) && xForwardedFor.length > 0) {
    return xForwardedFor[0].trim();
  }

  return req.ip;
}

function resolveHostId(req: ApiLoggingRequest): number | undefined {
  const hostFromUser = toNumber(req.user?.hostId);
  if (hostFromUser !== undefined) {
    return hostFromUser;
  }

  const fromHeader = toNumber(req.headers['x-host-id']);
  if (fromHeader !== undefined) {
    return fromHeader;
  }

  if (isPlainObject(req.body)) {
    return toNumber(req.body.hostId);
  }

  return undefined;
}

function resolveUserId(req: ApiLoggingRequest): number | undefined {
  const userFromAuth = toNumber(req.user?.id);
  if (userFromAuth !== undefined) {
    return userFromAuth;
  }

  if (isPlainObject(req.body)) {
    return toNumber(req.body.userId);
  }

  return undefined;
}

function resolveDeviceId(req: ApiLoggingRequest): string | null | undefined {
  const fromHeader = req.headers['x-device-id'];
  if (typeof fromHeader === 'string' && fromHeader.trim() !== '') {
    return fromHeader.trim();
  }

  if (Array.isArray(fromHeader) && fromHeader[0]?.trim()) {
    return fromHeader[0].trim();
  }

  if (isPlainObject(req.body)) {
    const fromBody = toStringOrUndefined(req.body.deviceId);
    if (fromBody !== undefined) {
      return fromBody;
    }
  }

  return undefined;
}

function errorMessageFromUnknown(error: unknown): string {
  if (error instanceof Error) {
    return error.message;
  }

  if (isPlainObject(error) && typeof error.message === 'string') {
    return error.message;
  }

  return 'Unhandled API error';
}

export function createApiLoggingMiddleware(service: ApiLogService = apiLogService): RequestHandler {
  return async (req: ApiLoggingRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      if (req.apiLoggingDisabled === true) {
        next();
        return;
      }

      const endpoint = getEndpoint(req);
      if (shouldSkipPath(endpoint)) {
        next();
        return;
      }

      const startTime = process.hrtime.bigint();
      const requestTime = Math.floor(Date.now() / 1000);
      const requestDate = new Date().toISOString().slice(0, 10);
      const maxBodyBytes = Number.isFinite(DEFAULT_MAX_BODY_BYTES) && DEFAULT_MAX_BODY_BYTES > 0
        ? DEFAULT_MAX_BODY_BYTES
        : 32768;

      const maskedRequestBody = ensureSizeBound(maskSensitiveData(req.body), maxBodyBytes);
      const requestSize = getRequestSize(req, maskedRequestBody);

      const { category, module } = resolveCategoryAndModule(req, endpoint);

      const createLogPromise = service.createProcessingLog({
        hostId: resolveHostId(req),
        userId: resolveUserId(req),
        deviceId: resolveDeviceId(req),
        source: inferSource(req),
        category,
        module,
        apiEndpoint: `${req.method.toUpperCase()} ${endpoint}`,
        requestBody: maskedRequestBody,
        requestSize,
        requestTime,
        requestDate,
        ipAddress: resolveIpAddress(req),
        userAgent: toStringOrUndefined(req.headers['user-agent']),
      }).catch((error: unknown) => {
        logger.error('API logging create failed before controller execution.', {
          error: error instanceof Error ? error.message : String(error),
          endpoint,
        });
        return null;
      });

      const apiLogId = await withTimeout(createLogPromise, API_LOG_CREATE_TIMEOUT_MS);
      if (apiLogId !== null) {
        req.apiLogId = apiLogId;
      }

      let capturedResponseBody: unknown;

      const originalJson = res.json.bind(res);
      res.json = ((body: unknown) => {
        capturedResponseBody = body;
        return originalJson(body);
      }) as typeof res.json;

      const originalSend = res.send.bind(res);
      res.send = ((body: unknown) => {
        if (capturedResponseBody === undefined) {
          capturedResponseBody = body;
        }
        return originalSend(body);
      }) as typeof res.send;

      res.on('finish', () => {
        try {
          if (req.apiLogId === undefined) {
            return;
          }

          const responseTime = Math.floor(Date.now() / 1000);
          const durationMilliseconds = getDurationMilliseconds(startTime);
          const responseStatusCode = res.statusCode;
          const status = responseStatusCode < 400 ? 'SUCCESS' : 'FAILED';
          const maskedResponseBody = capturedResponseBody === undefined
            ? undefined
            : ensureSizeBound(maskSensitiveData(capturedResponseBody), maxBodyBytes);
          const responseSize = getResponseSize(res, maskedResponseBody);
          const locals = res.locals as ApiLoggingLocals;

          const payload: ApiLogFinalizeInput = {
            apiLogId: req.apiLogId,
            status,
            responseStatusCode,
            responseBody: maskedResponseBody,
            responseSize,
            responseTime,
            durationMilliseconds,
            errorMessage: locals.apiLoggingErrorMessage,
          };

          void service.queueFinalizeLog(payload);
        } catch (error: unknown) {
          logger.error('API logging finalize enqueue failed after response finish.', {
            error: error instanceof Error ? error.message : String(error),
            endpoint,
          });
        }
      });

      next();
    } catch (error: unknown) {
      logger.error('API logging middleware failed; continuing request without logging.', {
        error: error instanceof Error ? error.message : String(error),
        path: req.originalUrl,
      });
      next();
    }
  };
}

export const ApiLoggingMiddleware = createApiLoggingMiddleware();

export function disableApiLoggingForRoute(): RequestHandler {
  return (req: ApiLoggingRequest, _res: Response, next: NextFunction): void => {
    req.apiLoggingDisabled = true;
    next();
  };
}

export function apiLogRouteContext(category: string, module: string): RequestHandler {
  const normalizedCategory = category.trim().toLowerCase();
  const normalizedModule = module.trim().toLowerCase();

  return (req: ApiLoggingRequest, _res: Response, next: NextFunction): void => {
    req.apiLogContext = {
      category: normalizedCategory,
      module: normalizedModule,
    };

    next();
  };
}

export function createApiLoggingErrorMiddleware(): ErrorRequestHandler {
  return (error: unknown, req: ApiLoggingRequest, res: Response, next: NextFunction): void => {
    if (req.apiLogId !== undefined) {
      const locals = res.locals as ApiLoggingLocals;
      locals.apiLoggingErrorMessage = errorMessageFromUnknown(error);
    }

    next(error);
  };
}

export const ApiLoggingErrorMiddleware = createApiLoggingErrorMiddleware();
