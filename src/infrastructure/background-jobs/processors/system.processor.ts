import type { Job } from 'bullmq';

import { apiLogService, ApiLogService } from '../../../modules/api-logs/services/api-log.service';
import type { ApiLogFinalizeJobPayload } from '../../../modules/api-logs/types/api-log.types';
import type { JsonObject, JsonValue } from '../../../modules/api-logs/types/api-log.types';
import { JOB_NAMES } from '../constants/job-names.constant';
import { PROCESSOR_NAMES } from '../constants/processor-names.constant';
import type { BackgroundJobEnvelope, JobPayload } from '../interfaces/background-job.interface';
import type { BaseProcessor } from '../interfaces/processor.interface';
import {
  noopBackgroundJobLogger,
  type BackgroundJobLogger,
} from '../utils/logger.utils';

interface SystemProcessorResult {
  readonly acknowledged: true;
  readonly handled: 'api-log-finalize' | 'dead-letter';
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function toFiniteNumber(value: unknown): number | null {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return value;
  }

  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : null;
  }

  return null;
}

function toNullableString(value: unknown): string | null {
  if (value === null || value === undefined) {
    return null;
  }

  return String(value);
}

function toJsonValue(value: unknown): JsonValue {
  if (value === null) {
    return null;
  }

  if (typeof value === 'string' || typeof value === 'number' || typeof value === 'boolean') {
    return value;
  }

  if (Array.isArray(value)) {
    return value.map((item) => toJsonValue(item));
  }

  if (!isRecord(value)) {
    return String(value);
  }

  const objectValue: JsonObject = {};
  for (const [key, childValue] of Object.entries(value)) {
    objectValue[key] = toJsonValue(childValue);
  }

  return objectValue;
}

function parseFinalizePayload(payload: unknown): ApiLogFinalizeJobPayload {
  if (!isRecord(payload)) {
    throw new Error('API log finalize payload must be an object.');
  }

  const apiLogId = toFiniteNumber(payload.apiLogId);
  const responseStatusCode = toFiniteNumber(payload.responseStatusCode);
  const responseTime = toFiniteNumber(payload.responseTime);
  const durationMilliseconds = toFiniteNumber(payload.durationMilliseconds);

  if (apiLogId === null || responseStatusCode === null || responseTime === null || durationMilliseconds === null) {
    throw new Error('API log finalize payload has invalid numeric fields.');
  }

  const status = payload.status;
  if (status !== 'SUCCESS' && status !== 'FAILED') {
    throw new Error('API log finalize payload status must be SUCCESS or FAILED.');
  }

  return {
    apiLogId,
    status,
    responseStatusCode,
    responseBody: toJsonValue(payload.responseBody),
    responseSize: toFiniteNumber(payload.responseSize) ?? undefined,
    responseTime,
    durationMilliseconds,
    errorMessage: toNullableString(payload.errorMessage),
  };
}

export class SystemProcessor implements BaseProcessor<JobPayload, SystemProcessorResult> {
  public readonly id = PROCESSOR_NAMES.SYSTEM;

  public constructor(
    private readonly logger: BackgroundJobLogger = noopBackgroundJobLogger,
    private readonly logService: ApiLogService = apiLogService,
  ) {}

  public async process(job: Job<JobPayload, SystemProcessorResult, string>): Promise<SystemProcessorResult> {
    const envelope = job.data as BackgroundJobEnvelope<JobPayload>;
    const payload = isRecord(envelope.payload) ? envelope.payload : null;

    if (job.name === JOB_NAMES.API_LOG_FINALIZE) {
      const parsedPayload = parseFinalizePayload(payload);
      await this.logService.finalizeFromQueue(parsedPayload);
      return {
        acknowledged: true,
        handled: 'api-log-finalize',
      };
    }

    if (job.name === JOB_NAMES.DEAD_LETTER) {
      this.logger.info('Dead-letter job acknowledged by system processor.', {
        queue: 'background-system',
        jobId: job.id === undefined ? undefined : String(job.id),
        jobName: job.name,
      });
      return {
        acknowledged: true,
        handled: 'dead-letter',
      };
    }

    throw new Error(`Unsupported system job name: ${job.name}`);
  }
}

export const systemProcessor = new SystemProcessor();
