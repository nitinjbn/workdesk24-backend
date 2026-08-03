import { logger } from '../../../config/database';
import { apiLogQueue, ApiLogQueue } from '../../../infrastructure/background-jobs/queues/api-log.queue';
import { ApiLogRepository, apiLogRepository } from '../repositories/api-log.repository';
import type {
  ApiLogCreateInput,
  ApiLogFinalizeInput,
  ApiLogFinalizeJobPayload,
} from '../types/api-log.types';

export class ApiLogService {
  public constructor(
    private readonly repository: ApiLogRepository = apiLogRepository,
    private readonly queue: ApiLogQueue = apiLogQueue,
  ) {}

  public async createProcessingLog(input: ApiLogCreateInput): Promise<number | null> {
    try {
      return await this.repository.createProcessingRecord(input);
    } catch (error: unknown) {
      logger.error('Failed to create PROCESSING API log record.', {
        error: error instanceof Error ? error.message : String(error),
        endpoint: input.apiEndpoint,
      });
      return null;
    }
  }

  public async queueFinalizeLog(input: ApiLogFinalizeInput): Promise<void> {
    const payload: ApiLogFinalizeJobPayload = {
      apiLogId: input.apiLogId,
      status: input.status,
      responseStatusCode: input.responseStatusCode,
      responseBody: input.responseBody,
      responseSize: input.responseSize,
      responseTime: input.responseTime,
      durationMilliseconds: input.durationMilliseconds,
      errorMessage: input.errorMessage ?? null,
    };

    try {
      await this.queue.dispatchFinalizeUpdate(payload, {
        jobId: `api-log-finalize:${input.apiLogId}:${input.responseTime}`,
      });
    } catch (error: unknown) {
      logger.error('Failed to queue API log finalize job.', {
        error: error instanceof Error ? error.message : String(error),
        apiLogId: input.apiLogId,
      });
    }
  }

  public async finalizeFromQueue(input: ApiLogFinalizeJobPayload): Promise<void> {
    await this.repository.finalizeRecord(input);
  }
}

export const apiLogService = new ApiLogService();
