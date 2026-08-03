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
    await ApiLog.update(
      {
        status: input.status,
        responseStatusCode: input.responseStatusCode,
        responseBody: toModelJsonObject(input.responseBody),
        responseSize: input.responseSize,
        responseTime: input.responseTime,
        durationMilliseconds: input.durationMilliseconds,
        errorMessage: input.errorMessage ?? null,
      },
      {
        where: {
          id: input.apiLogId,
        },
      },
    );
  }
}

export const apiLogRepository = new ApiLogRepository();
