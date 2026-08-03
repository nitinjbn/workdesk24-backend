import { JOB_NAMES } from '../constants/job-names.constant';
import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { BackgroundJobManager } from '../interfaces/background-job-manager.interface';
import type { ManagedBackgroundJob } from '../interfaces/background-job-manager.interface';
import type { QueueJobOptions } from '../interfaces/queue-job-options.interface';
import { backgroundJobManager } from '../managers/BackgroundJobManager';
import type { ApiLogFinalizeJobPayload } from '../../../modules/api-logs/types/api-log.types';

export class ApiLogQueue {
  public constructor(
    private readonly jobManager: BackgroundJobManager = backgroundJobManager,
  ) {}

  public async dispatchFinalizeUpdate(
    payload: ApiLogFinalizeJobPayload,
    options?: QueueJobOptions,
  ): Promise<ManagedBackgroundJob<ApiLogFinalizeJobPayload, typeof JOB_NAMES.API_LOG_FINALIZE>> {
    return this.jobManager.dispatch({
      queue: QUEUE_NAMES.SYSTEM,
      job: JOB_NAMES.API_LOG_FINALIZE,
      payload,
      options: {
        attempts: 3,
        backoff: {
          type: 'fixed',
          delay: 1000,
        },
        removeOnComplete: {
          count: 500,
        },
        removeOnFail: {
          count: 1000,
        },
        ...options,
      },
    });
  }
}

export const apiLogQueue = new ApiLogQueue();
