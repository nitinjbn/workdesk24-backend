import { randomUUID } from 'node:crypto';

import type { Job, JobsOptions, Queue } from 'bullmq';

import type {
  BackgroundJobManager,
  BackgroundJobState,
  DeadLetterOptions,
  DispatchBulkRequest,
  DispatchRequest,
  JobProgress,
  JobStatusSnapshot,
  ManagedBackgroundJob,
  QueueDrainOptions,
  RetryFailedJobsOptions,
} from '../interfaces/background-job-manager.interface';
import type {
  BackgroundJobEnvelope,
  JobMetadata,
  JobPayload,
} from '../interfaces/background-job.interface';
import { JOB_NAMES } from '../constants/job-names.constant';
import type { QueueJobOptions } from '../interfaces/queue-job-options.interface';
import type { QueueIdentifier } from '../constants/queue-names.constant';
import { QUEUE_NAMES, type QueueName } from '../constants/queue-names.constant';
import {
  BackgroundJobFrameworkError,
  BackgroundJobNotFoundError,
  BackgroundJobProviderError,
  BackgroundJobValidationError,
} from '../errors/background-job.error';
import { QueueRegistry } from '../registry/queue.registry';
import {
  noopBackgroundJobLogger,
  type BackgroundJobLogger,
} from '../utils/logger.utils';
import { QueueManager } from './QueueManager';

const FRAMEWORK_VERSION = '1.0.0';
const MAX_BULLMQ_PRIORITY = 2_097_151;

function toBullMQJobOptions(options: QueueJobOptions | undefined): JobsOptions | undefined {
  if (options === undefined) {
    return undefined;
  }

  return {
    jobId: options.jobId,
    priority: options.priority,
    delay: options.delay,
    attempts: options.attempts,
    backoff: options.backoff,
    removeOnComplete: options.removeOnComplete,
    removeOnFail: options.removeOnFail,
    lifo: options.lifo,
  };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

function normalizeState(state: string): BackgroundJobState {
  if (state === 'waiting-children') {
    return 'waiting';
  }

  if (state === 'waiting' || state === 'active' || state === 'completed' || state === 'failed' || state === 'delayed' || state === 'prioritized') {
    return state;
  }

  return 'unknown';
}

interface PreparedDispatch<TPayload extends JobPayload, TName extends string> {
  readonly queue: QueueName;
  readonly job: TName;
  readonly data: BackgroundJobEnvelope<TPayload>;
  readonly options?: QueueJobOptions;
}

interface DeadLetterPayload extends JobPayload {
  readonly originalQueue: QueueName;
  readonly originalJobId: string;
  readonly originalJobName: string;
  readonly originalPayload: JobPayload;
  readonly originalMetadata: JobMetadata;
  readonly failedReason?: string;
  readonly reason?: string;
  readonly movedAt: string;
}

/** BullMQ adapter for the provider-neutral BackgroundJobManager contract. */
export class BullMQBackgroundJobManager implements BackgroundJobManager {
  public constructor(
    private readonly queueManager: QueueManager = QueueManager.getInstance(),
    private readonly queueRegistry: QueueRegistry = new QueueRegistry(),
    private readonly logger: BackgroundJobLogger = noopBackgroundJobLogger,
  ) {}

  /** Submit one job and return its provider-neutral representation. */
  public async dispatch<TPayload extends JobPayload, TName extends string>(
    request: DispatchRequest<TPayload, TName>,
  ): Promise<ManagedBackgroundJob<TPayload, TName>> {
    const prepared = this.prepareDispatch(request);

    return this.withProviderErrors('dispatch', async () => {
      const queue = this.getQueue(prepared.queue);
      if (prepared.options?.jobId !== undefined) {
        const existingJob = await queue.getJob(prepared.options.jobId);
        if (existingJob !== undefined) {
          return this.toManagedJob<TPayload, TName>(prepared.queue, existingJob);
        }
      }

      const queuedJob = await queue.add(prepared.job, prepared.data, toBullMQJobOptions(prepared.options));
      const managedJob = await this.toManagedJob<TPayload, TName>(prepared.queue, queuedJob);
      this.logger.info('Background job dispatched.', {
        queue: prepared.queue,
        jobId: managedJob.id,
        jobName: prepared.job,
      });

      return managedJob;
    });
  }

  /** Submit many jobs to the same queue using BullMQ's bulk API. */
  public async dispatchBulk<TPayload extends JobPayload, TName extends string>(
    request: DispatchBulkRequest<TPayload, TName>,
  ): Promise<ReadonlyArray<ManagedBackgroundJob<TPayload, TName>>> {
    if (request.jobs.length === 0) {
      throw new BackgroundJobValidationError('Bulk dispatch requires at least one job.');
    }

    const preparedJobs = request.jobs.map((job) => this.prepareDispatch({
      ...job,
      queue: request.queue,
    }));

    return this.withProviderErrors('dispatch jobs in bulk', async () => {
      const queue = this.getQueue(preparedJobs[0].queue);
      const existingJobs = await Promise.all(preparedJobs.map((job) => (
        job.options?.jobId === undefined ? Promise.resolve(undefined) : queue.getJob(job.options.jobId)
      )));
      const jobsToCreate = preparedJobs.filter((_, index) => existingJobs[index] === undefined);
      const createdJobs = jobsToCreate.length === 0 ? [] : await queue.addBulk(jobsToCreate.map((job) => ({
        name: job.job,
        data: job.data,
        opts: toBullMQJobOptions(job.options),
      })));

      let createdJobIndex = 0;
      const managedJobs: Array<ManagedBackgroundJob<TPayload, TName>> = [];
      for (let index = 0; index < preparedJobs.length; index += 1) {
        const providerJob = existingJobs[index] ?? createdJobs[createdJobIndex++];
        managedJobs.push(await this.toManagedJob<TPayload, TName>(preparedJobs[index].queue, providerJob));
      }

      this.logger.info('Background jobs dispatched in bulk.', {
        queue: preparedJobs[0].queue,
        count: managedJobs.length,
      });

      return managedJobs;
    });
  }

  /** Submit one job after a validated delay in milliseconds. */
  public async dispatchDelayed<TPayload extends JobPayload, TName extends string>(
    request: DispatchRequest<TPayload, TName>,
    delay: number,
  ): Promise<ManagedBackgroundJob<TPayload, TName>> {
    this.validateDelay(delay);
    return this.dispatch({
      ...request,
      options: {
        ...request.options,
        delay,
      },
    });
  }

  /** Submit one deduplicated job; request options must include jobId. */
  public async dispatchUnique<TPayload extends JobPayload, TName extends string>(
    request: DispatchRequest<TPayload, TName>,
  ): Promise<ManagedBackgroundJob<TPayload, TName>> {
    if (request.options?.jobId === undefined || request.options.jobId.trim() === '') {
      throw new BackgroundJobValidationError('dispatchUnique requires options.jobId.');
    }

    return this.dispatch(request);
  }

  /** Remove an existing job from its queue. */
  public async remove(queueName: QueueIdentifier, jobId: string): Promise<void> {
    const queue = this.queueRegistry.resolve(queueName);
    this.validateJobId(jobId);

    await this.withProviderErrors('remove', async () => {
      const job = await this.requireJob(queue, jobId);
      await job.remove();
      this.logger.info('Background job removed.', { queue, jobId });
    });
  }

  /** Retry an existing failed job. */
  public async retry(queueName: QueueIdentifier, jobId: string): Promise<void> {
    const queue = this.queueRegistry.resolve(queueName);
    this.validateJobId(jobId);

    await this.withProviderErrors('retry', async () => {
      const job = await this.requireJob(queue, jobId);
      await job.retry();
      this.logger.info('Background job retried.', { queue, jobId });
    });
  }

  /** Retry failed jobs in a queue up to the configured limit. */
  public async retryFailedJobs(queueName: QueueIdentifier, options?: RetryFailedJobsOptions): Promise<number> {
    const queue = this.queueRegistry.resolve(queueName);
    const limit = options?.limit ?? 100;
    if (!Number.isInteger(limit) || limit < 1) {
      throw new BackgroundJobValidationError('retryFailedJobs limit must be a positive integer.');
    }

    return this.withProviderErrors('retry failed jobs', async () => {
      const failedJobs = await this.getQueue(queue).getFailed(0, limit - 1);
      let retriedCount = 0;

      for (const failedJob of failedJobs) {
        try {
          await failedJob.retry();
          retriedCount += 1;
        } catch (error: unknown) {
          this.logger.error('Failed to retry one failed background job.', error, {
            queue,
            jobId: failedJob.id === undefined ? undefined : String(failedJob.id),
            jobName: failedJob.name,
          });
        }
      }

      this.logger.info('Background failed job retry batch completed.', {
        queue,
        requestedLimit: limit,
        retriedCount,
      });

      return retriedCount;
    });
  }

  /** Move one failed job payload to dead-letter queue for triage. */
  public async moveToDeadLetter(queueName: QueueIdentifier, jobId: string, options?: DeadLetterOptions): Promise<void> {
    const queue = this.queueRegistry.resolve(queueName);
    this.validateJobId(jobId);

    await this.withProviderErrors('move to dead-letter queue', async () => {
      const job = await this.requireJob(queue, jobId);
      if (!this.isEnvelope(job.data)) {
        throw new BackgroundJobValidationError('Dead-letter move requires framework envelope data.');
      }

      const deadLetterPayload: DeadLetterPayload = {
        originalQueue: queue,
        originalJobId: String(job.id),
        originalJobName: job.name,
        originalPayload: job.data.payload,
        originalMetadata: job.data.metadata,
        failedReason: job.failedReason,
        reason: options?.reason,
        movedAt: new Date().toISOString(),
      };

      await this.dispatch({
        queue: QUEUE_NAMES.SYSTEM,
        job: JOB_NAMES.DEAD_LETTER,
        payload: deadLetterPayload,
        options: {
          jobId: `dead-letter:${queue}:${jobId}`,
          correlationId: job.data.metadata.correlationId,
          requestId: job.data.metadata.requestId,
          metadata: {
            sourceQueue: queue,
            sourceJobId: String(job.id),
            sourceJobName: job.name,
            failedReason: job.failedReason,
          },
        },
      });

      await job.remove();
      this.logger.info('Background job moved to dead-letter queue.', {
        queue,
        jobId,
      });
    });
  }

  /** Cancel a removable job; active jobs are not canceled. */
  public async cancel(queueName: QueueIdentifier, jobId: string): Promise<boolean> {
    const queue = this.queueRegistry.resolve(queueName);
    this.validateJobId(jobId);

    return this.withProviderErrors('cancel', async () => {
      const job = await this.getQueue(queue).getJob(jobId);
      if (job === undefined) {
        return false;
      }

      const state = normalizeState(await job.getState());
      if (state === 'active') {
        this.logger.info('Background job cancellation skipped because job is active.', {
          queue,
          jobId,
        });
        return false;
      }

      await job.remove();
      this.logger.info('Background job canceled.', {
        queue,
        jobId,
      });
      return true;
    });
  }

  /** Retrieve a job without exposing the provider's job object. */
  public async getJob<TPayload extends JobPayload = JobPayload, TName extends string = string>(
    queueName: QueueIdentifier,
    jobId: string,
  ): Promise<ManagedBackgroundJob<TPayload, TName> | null> {
    const queue = this.queueRegistry.resolve(queueName);
    this.validateJobId(jobId);

    return this.withProviderErrors('retrieve', async () => {
      const job = await this.getQueue(queue).getJob(jobId);
      return job === undefined ? null : this.toManagedJob<TPayload, TName>(queue, job);
    });
  }

  /** Retrieve the normalized state of a job. */
  public async getJobState(queueName: QueueIdentifier, jobId: string): Promise<BackgroundJobState | null> {
    const queue = this.queueRegistry.resolve(queueName);
    this.validateJobId(jobId);

    return this.withProviderErrors('retrieve job state', async () => {
      const job = await this.getQueue(queue).getJob(jobId);
      return job === undefined ? null : normalizeState(await job.getState());
    });
  }

  /** Retrieve job progress, if present. */
  public async getJobProgress(queueName: QueueIdentifier, jobId: string): Promise<JobProgress> {
    const queue = this.queueRegistry.resolve(queueName);
    this.validateJobId(jobId);

    return this.withProviderErrors('retrieve job progress', async () => {
      const job = await this.getQueue(queue).getJob(jobId);
      if (job === undefined) {
        return null;
      }

      const progress = job.progress;
      if (typeof progress === 'number') {
        return progress;
      }
      if (isRecord(progress)) {
        return progress;
      }

      return null;
    });
  }

  /** Retrieve a provider-neutral status snapshot for one job. */
  public async getJobStatus(queueName: QueueIdentifier, jobId: string): Promise<JobStatusSnapshot | null> {
    const queue = this.queueRegistry.resolve(queueName);
    this.validateJobId(jobId);

    return this.withProviderErrors('retrieve job status', async () => {
      const job = await this.getQueue(queue).getJob(jobId);
      if (job === undefined) {
        return null;
      }

      const progress = job.progress;
      const normalizedProgress: JobProgress = typeof progress === 'number' || isRecord(progress) ? progress : null;

      return {
        id: String(job.id),
        queue,
        name: job.name,
        state: normalizeState(await job.getState()),
        attemptsMade: job.attemptsMade,
        attemptsAllowed: typeof job.opts.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 1,
        progress: normalizedProgress,
        failedReason: job.failedReason,
      };
    });
  }

  /** Pause queue processing. */
  public async pauseQueue(queueName: QueueIdentifier): Promise<void> {
    const queue = this.queueRegistry.resolve(queueName);

    await this.withProviderErrors('pause queue', async () => {
      await this.getQueue(queue).pause();
      this.logger.info('Background queue paused.', { queue });
    });
  }

  /** Resume queue processing. */
  public async resumeQueue(queueName: QueueIdentifier): Promise<void> {
    const queue = this.queueRegistry.resolve(queueName);

    await this.withProviderErrors('resume queue', async () => {
      await this.getQueue(queue).resume();
      this.logger.info('Background queue resumed.', { queue });
    });
  }

  /** Drain queue waiting jobs, optionally including delayed jobs. */
  public async drainQueue(queueName: QueueIdentifier, options?: QueueDrainOptions): Promise<void> {
    const queue = this.queueRegistry.resolve(queueName);

    await this.withProviderErrors('drain queue', async () => {
      await this.getQueue(queue).drain(options?.includeDelayed === true);
      this.logger.info('Background queue drained.', {
        queue,
        includeDelayed: options?.includeDelayed === true,
      });
    });
  }

  /** Return whether a job completed successfully. */
  public async isCompleted(queue: QueueIdentifier, jobId: string): Promise<boolean> {
    return (await this.getJobState(queue, jobId)) === 'completed';
  }

  /** Return whether a job has permanently failed. */
  public async isFailed(queue: QueueIdentifier, jobId: string): Promise<boolean> {
    return (await this.getJobState(queue, jobId)) === 'failed';
  }

  /** Return whether a worker is currently processing a job. */
  public async isActive(queue: QueueIdentifier, jobId: string): Promise<boolean> {
    return (await this.getJobState(queue, jobId)) === 'active';
  }

  /** Return whether a job is waiting for a worker. */
  public async isWaiting(queue: QueueIdentifier, jobId: string): Promise<boolean> {
    return (await this.getJobState(queue, jobId)) === 'waiting';
  }

  private prepareDispatch<TPayload extends JobPayload, TName extends string>(
    request: DispatchRequest<TPayload, TName>,
  ): PreparedDispatch<TPayload, TName> {
    const queue = this.queueRegistry.resolve(request.queue);
    this.validateJobName(request.job);
    this.validatePayload(request.payload);
    this.validateOptions(request.options);

    return {
      queue,
      job: request.job,
      data: {
        payload: request.payload,
        metadata: this.createMetadata(request.options),
      },
      options: request.options,
    };
  }

  private getQueue(queueName: QueueName): Queue<JobPayload, unknown, string> {
    return this.queueManager.getQueue<JobPayload, unknown, string>(queueName);
  }

  private async requireJob(queueName: QueueName, jobId: string): Promise<Job<JobPayload, unknown, string>> {
    const job = await this.getQueue(queueName).getJob(jobId);
    if (job === undefined) {
      throw new BackgroundJobNotFoundError(queueName, jobId);
    }

    return job;
  }

  private async toManagedJob<TPayload extends JobPayload, TName extends string>(
    queue: QueueName,
    job: Job<JobPayload, unknown, string>,
  ): Promise<ManagedBackgroundJob<TPayload, TName>> {
    if (job.id === undefined) {
      throw new BackgroundJobProviderError('read', new BackgroundJobValidationError('Provider returned a job without an identifier.'));
    }
    if (!this.isEnvelope(job.data)) {
      throw new BackgroundJobProviderError('read', new BackgroundJobValidationError(`Job "${job.id}" does not contain framework metadata.`));
    }

    return {
      id: job.id,
      queue,
      name: job.name as TName,
      data: job.data as BackgroundJobEnvelope<TPayload>,
      state: normalizeState(await job.getState()),
    };
  }

  private isEnvelope(data: JobPayload): data is BackgroundJobEnvelope<JobPayload> {
    return isRecord(data.payload)
      && isRecord(data.metadata)
      && typeof data.metadata.correlationId === 'string'
      && typeof data.metadata.createdAt === 'string'
      && typeof data.metadata.frameworkVersion === 'string';
  }

  private createMetadata(options: QueueJobOptions | undefined): JobMetadata {
    const correlationId = options?.correlationId?.trim() || randomUUID();
    const requestId = options?.requestId?.trim();

    return {
      ...options?.metadata,
      correlationId,
      ...(requestId === undefined || requestId === '' ? {} : { requestId }),
      createdAt: new Date().toISOString(),
      frameworkVersion: FRAMEWORK_VERSION,
    };
  }

  private validateJobName(job: string): void {
    if (job.trim() === '') {
      throw new BackgroundJobValidationError('Job name is required.');
    }
  }

  private validateJobId(jobId: string): void {
    if (jobId.trim() === '') {
      throw new BackgroundJobValidationError('Job ID is required.');
    }
  }

  private validatePayload(payload: unknown): void {
    if (!isRecord(payload)) {
      throw new BackgroundJobValidationError('Job payload must be a non-null object.');
    }
  }

  private validateOptions(options: QueueJobOptions | undefined): void {
    if (options === undefined) {
      return;
    }

    if (options.jobId !== undefined) {
      this.validateJobId(options.jobId);
    }
    if (options.correlationId !== undefined && options.correlationId.trim() === '') {
      throw new BackgroundJobValidationError('correlationId cannot be empty.');
    }
    if (options.requestId !== undefined && options.requestId.trim() === '') {
      throw new BackgroundJobValidationError('requestId cannot be empty.');
    }
    if (options.priority !== undefined && (!Number.isSafeInteger(options.priority) || options.priority < 0 || options.priority > MAX_BULLMQ_PRIORITY)) {
      throw new BackgroundJobValidationError(`priority must be an integer between 0 and ${MAX_BULLMQ_PRIORITY}.`);
    }
    if (options.delay !== undefined) {
      this.validateDelay(options.delay);
    }
    if (options.attempts !== undefined && (!Number.isSafeInteger(options.attempts) || options.attempts < 1)) {
      throw new BackgroundJobValidationError('attempts must be a positive integer.');
    }
    if (options.backoff !== undefined) {
      this.validateDelay(options.backoff.delay);
    }
    this.validateRetentionPolicy(options.removeOnComplete, 'removeOnComplete');
    this.validateRetentionPolicy(options.removeOnFail, 'removeOnFail');
    if (options.lifo !== undefined && typeof options.lifo !== 'boolean') {
      throw new BackgroundJobValidationError('lifo must be a boolean.');
    }
    if (options.metadata !== undefined && !isRecord(options.metadata)) {
      throw new BackgroundJobValidationError('metadata must be an object.');
    }
  }

  private validateDelay(delay: number): void {
    if (!Number.isSafeInteger(delay) || delay < 0) {
      throw new BackgroundJobValidationError('delay must be a non-negative integer in milliseconds.');
    }
  }

  private validateRetentionPolicy(policy: QueueJobOptions['removeOnComplete'], field: string): void {
    if (policy === undefined || typeof policy === 'boolean') {
      return;
    }
    if (typeof policy === 'number') {
      if (!Number.isSafeInteger(policy) || policy < 0) {
        throw new BackgroundJobValidationError(`${field} must be a non-negative integer, boolean, or retention object.`);
      }
      return;
    }
    if (('age' in policy && (!Number.isSafeInteger(policy.age) || policy.age < 0))
      || (policy.count !== undefined && (!Number.isSafeInteger(policy.count) || policy.count < 0))) {
      throw new BackgroundJobValidationError(`${field} retention values must be non-negative integers.`);
    }
  }

  private async withProviderErrors<TResult>(operation: string, action: () => Promise<TResult>): Promise<TResult> {
    try {
      return await action();
    } catch (error: unknown) {
      if (error instanceof BackgroundJobFrameworkError) {
        throw error;
      }

      this.logger.error('Background job provider operation failed.', error, { operation });
      throw new BackgroundJobProviderError(operation, error);
    }
  }
}

/** The sole application-facing job manager instance for the current provider. */
export const backgroundJobManager: BackgroundJobManager = new BullMQBackgroundJobManager();
