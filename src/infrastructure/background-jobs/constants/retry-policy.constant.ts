import type { BackoffOptions, DefaultJobOptions, KeepJobs } from 'bullmq';

const SECONDS_PER_DAY = 24 * 60 * 60;

export const RETRY_POLICY = {
  ATTEMPTS: 5,
  BACKOFF: {
    type: 'exponential',
    delay: 1_000,
  } satisfies BackoffOptions,
  REMOVE_ON_COMPLETE: {
    age: SECONDS_PER_DAY,
    count: 1_000,
  } satisfies KeepJobs,
  REMOVE_ON_FAIL: {
    age: 7 * SECONDS_PER_DAY,
    count: 5_000,
  } satisfies KeepJobs,
} as const;

export const DEFAULT_JOB_OPTIONS: Readonly<DefaultJobOptions> = {
  attempts: RETRY_POLICY.ATTEMPTS,
  backoff: RETRY_POLICY.BACKOFF,
  removeOnComplete: RETRY_POLICY.REMOVE_ON_COMPLETE,
  removeOnFail: RETRY_POLICY.REMOVE_ON_FAIL,
};
