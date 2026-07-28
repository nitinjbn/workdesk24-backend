import type { JobPriority } from '../constants/job-priority.constant';

export interface JobBackoffOptions {
  readonly type: 'fixed' | 'exponential';
  readonly delay: number;
}

export type JobRetentionOptions =
  | { readonly count: number }
  | { readonly age: number; readonly count?: number };

export type JobRetentionPolicy = boolean | number | JobRetentionOptions;

/**
 * Provider-neutral per-job overrides. Retry and retention defaults remain owned
 * by the framework unless explicitly overridden for an individual job.
 */
export interface QueueJobOptions {
  readonly jobId?: string;
  readonly priority?: JobPriority;
  readonly delay?: number;
  readonly attempts?: number;
  readonly backoff?: JobBackoffOptions;
  readonly removeOnComplete?: JobRetentionPolicy;
  readonly removeOnFail?: JobRetentionPolicy;
  readonly lifo?: boolean;
  readonly correlationId?: string;
  readonly requestId?: string;
  readonly metadata?: Readonly<Record<string, unknown>>;
}
