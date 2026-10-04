import { ApiLog } from '../../../models';
import type { ApiLogCreateInput, ApiLogFinalizeInput } from '../types/api-log.types';

function isObjectLike(value: unknown): value is object {
  return typeof value === 'object' && value !== null;
}

function toModelJsonObject(value: unknown): object | undefined {
  if (value === undefined) {
    return undefined;
  }

  if (isObjectLike(value)) {
    return value;
  }

  return {
    value,
  };
}

export class ApiLogRepository {
  public async createProcessingRecord(input: ApiLogCreateInput): Promise<number> {
    const created = await ApiLog.create({
      hostId: input.hostId,
      userId: input.userId,
      deviceId: input.deviceId,
      source: input.source,
      category: input.category,
      module: input.module,
      apiEndpoint: input.apiEndpoint,
      requestBody: toModelJsonObject(input.requestBody),
      requestSize: input.requestSize,
      status: 'PROCESSING',
      requestTime: input.requestTime,
      requestDate: input.requestDate,
      ipAddress: input.ipAddress,
      userAgent: input.userAgent,
    });

    return created.id;
  }

  public async finalizeRecord(input: ApiLogFinalizeInput): Promise<void> {
    const update: Record<string, unknown> = {
      status: input.status,
      responseStatusCode: input.responseStatusCode,
      responseBody: toModelJsonObject(input.responseBody),
      responseSize: input.responseSize,
      responseTime: input.responseTime,
      durationMilliseconds: input.durationMilliseconds,
      errorMessage: input.errorMessage ?? null,
    };

    // hostId/userId are re-resolved at finalize time (after auth middleware ran),
    // so only overwrite when the finalize payload actually resolved them.
    if (input.hostId !== undefined) {
      update.hostId = input.hostId;
    }
    if (input.userId !== undefined) {
      update.userId = input.userId;
    }

    await ApiLog.update(update, {
      where: {
        id: input.apiLogId,
      },
    });
  }
}

export const apiLogRepository = new ApiLogRepository();
