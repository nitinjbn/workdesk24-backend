import type { QueueIdentifier } from '../constants/queue-names.constant';
import type { BackgroundJobEnvelope, JobPayload } from './background-job.interface';
import type { QueueJobOptions } from './queue-job-options.interface';

export type BackgroundJobState =
  | 'waiting'
  | 'active'
  | 'completed'
  | 'failed'
  | 'delayed'
  | 'prioritized'
  | 'unknown';

export type JobProgress = number | Readonly<Record<string, unknown>> | null;

export interface JobStatusSnapshot {
  readonly id: string;
  readonly queue: QueueIdentifier;
  readonly name: string;
  readonly state: BackgroundJobState;
  readonly attemptsMade: number;
  readonly attemptsAllowed: number;
  readonly progress: JobProgress;
  readonly failedReason?: string;
}

export interface QueueDrainOptions {
  readonly includeDelayed?: boolean;
}

export interface RetryFailedJobsOptions {
  readonly limit?: number;
}

export interface DeadLetterOptions {
  readonly reason?: string;
}

/** Input for submitting one job. */
export interface DispatchRequest<TPayload extends JobPayload = JobPayload, TName extends string = string> {
  readonly queue: QueueIdentifier;
  readonly job: TName;
  readonly payload: TPayload;
  readonly options?: QueueJobOptions;
}

/** Input for an efficient single-queue bulk submission. */
export interface DispatchBulkRequest<TPayload extends JobPayload = JobPayload, TName extends string = string> {
  readonly queue: QueueIdentifier;
  readonly jobs: ReadonlyArray<Omit<DispatchRequest<TPayload, TName>, 'queue'>>;
}

/** Provider-neutral representation of a stored job. */
export interface ManagedBackgroundJob<TPayload extends JobPayload = JobPayload, TName extends string = string> {
  readonly id: string;
  readonly queue: QueueIdentifier;
  readonly name: TName;
  readonly data: BackgroundJobEnvelope<TPayload>;
  readonly state: BackgroundJobState;
}

/**
 * Application-facing scheduling contract. Providers translate this contract to
 * their own primitives; feature modules must never depend on a queue library.
 */
export interface BackgroundJobManager {
  /** Submit one job immediately or according to options.delay. */
  dispatch<TPayload extends JobPayload, TName extends string>(
    request: DispatchRequest<TPayload, TName>,
  ): Promise<ManagedBackgroundJob<TPayload, TName>>;

  /** Submit many jobs to one queue through the provider's bulk API. */
  dispatchBulk<TPayload extends JobPayload, TName extends string>(
    request: DispatchBulkRequest<TPayload, TName>,
  ): Promise<ReadonlyArray<ManagedBackgroundJob<TPayload, TName>>>;

  /** Submit one job after a validated delay in milliseconds. */
  dispatchDelayed<TPayload extends JobPayload, TName extends string>(
    request: DispatchRequest<TPayload, TName>,
    delay: number,
  ): Promise<ManagedBackgroundJob<TPayload, TName>>;

  /** Submit one deduplicated job; requires options.jobId. */
  dispatchUnique<TPayload extends JobPayload, TName extends string>(
    request: DispatchRequest<TPayload, TName>,
  ): Promise<ManagedBackgroundJob<TPayload, TName>>;

  /** Remove an existing job. */
  remove(queue: QueueIdentifier, jobId: string): Promise<void>;

  /** Retry an existing failed job. */
  retry(queue: QueueIdentifier, jobId: string): Promise<void>;

  /** Retry failed jobs in bulk for an operational queue recovery workflow. */
  retryFailedJobs(queue: QueueIdentifier, options?: RetryFailedJobsOptions): Promise<number>;

  /** Move a failed job to a dead-letter queue entry for later triage. */
  moveToDeadLetter(queue: QueueIdentifier, jobId: string, options?: DeadLetterOptions): Promise<void>;

  /** Cancel a job when it still exists and is removable. */
  cancel(queue: QueueIdentifier, jobId: string): Promise<boolean>;

  /** Retrieve a job, returning null when it does not exist. */
  getJob<TPayload extends JobPayload = JobPayload, TName extends string = string>(
    queue: QueueIdentifier,
    jobId: string,
  ): Promise<ManagedBackgroundJob<TPayload, TName> | null>;

  /** Retrieve the normalized state of a job. */
  getJobState(queue: QueueIdentifier, jobId: string): Promise<BackgroundJobState | null>;

  /** Retrieve job processing progress if the provider reports it. */
  getJobProgress(queue: QueueIdentifier, jobId: string): Promise<JobProgress>;

  /** Retrieve a richer provider-neutral status snapshot for one job. */
  getJobStatus(queue: QueueIdentifier, jobId: string): Promise<JobStatusSnapshot | null>;

  /** Pause queue processing. */
  pauseQueue(queue: QueueIdentifier): Promise<void>;

  /** Resume queue processing. */
  resumeQueue(queue: QueueIdentifier): Promise<void>;

  /** Drain waiting jobs, with optional delayed drain. */
  drainQueue(queue: QueueIdentifier, options?: QueueDrainOptions): Promise<void>;

  /** Return whether a job is in the completed state. */
  isCompleted(queue: QueueIdentifier, jobId: string): Promise<boolean>;

  /** Return whether a job is in the failed state. */
  isFailed(queue: QueueIdentifier, jobId: string): Promise<boolean>;

  /** Return whether a job is actively being processed. */
  isActive(queue: QueueIdentifier, jobId: string): Promise<boolean>;

  /** Return whether a job is waiting to be processed. */
  isWaiting(queue: QueueIdentifier, jobId: string): Promise<boolean>;
}
