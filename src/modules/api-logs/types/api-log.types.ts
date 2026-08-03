import type { Request } from 'express';
import type { JobPayload } from '../../../infrastructure/background-jobs/interfaces/background-job.interface';

export type ApiLogSource = 'ANDROID' | 'IOS' | 'WEB' | 'CRON' | 'SYSTEM';
export type ApiLogStatus = 'SUCCESS' | 'FAILED' | 'PROCESSING';

export type JsonPrimitive = string | number | boolean | null;
export type JsonValue = JsonPrimitive | JsonObject | JsonArray;
export interface JsonObject {
  [key: string]: JsonValue;
}
export type JsonArray = JsonValue[];

export interface ApiLogCreateInput {
  readonly hostId?: number;
  readonly userId?: number;
  readonly deviceId?: string | null;
  readonly source: ApiLogSource;
  readonly category: string;
  readonly module: string;
  readonly apiEndpoint: string;
  readonly requestBody?: JsonValue;
  readonly requestSize?: number;
  readonly requestTime: number;
  readonly requestDate: string;
  readonly ipAddress?: string;
  readonly userAgent?: string;
}

export interface ApiLogFinalizeInput {
  readonly apiLogId: number;
  readonly status: Extract<ApiLogStatus, 'SUCCESS' | 'FAILED'>;
  readonly responseStatusCode: number;
  readonly responseBody?: JsonValue;
  readonly responseSize?: number;
  readonly responseTime: number;
  readonly durationMilliseconds: number;
  readonly errorMessage?: string | null;
}

export interface ApiLogFinalizeJobPayload extends JobPayload {
  readonly apiLogId: number;
  readonly status: Extract<ApiLogStatus, 'SUCCESS' | 'FAILED'>;
  readonly responseStatusCode: number;
  readonly responseBody?: JsonValue;
  readonly responseSize?: number;
  readonly responseTime: number;
  readonly durationMilliseconds: number;
  readonly errorMessage?: string | null;
}

export interface AuthenticatedRequestUser {
  readonly id?: number;
  readonly hostId?: number;
}

export interface ApiLoggingRequest extends Request {
  user?: AuthenticatedRequestUser;
  apiLogId?: number;
  apiLogContext?: {
    category: string;
    module: string;
  };
}

export interface ApiLoggingLocals {
  apiLoggingErrorMessage?: string;
}
