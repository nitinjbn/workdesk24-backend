import type { QueueOptions, WorkerOptions } from 'bullmq';

import { DEFAULT_JOB_OPTIONS, RETRY_POLICY } from '../constants/retry-policy.constant';
import { redisConnection } from './redis.config';

const DEFAULT_WORKER_CONCURRENCY = 5;

function readWorkerConcurrency(value: string | undefined): number {
  if (value === undefined || value.trim() === '') {
    return DEFAULT_WORKER_CONCURRENCY;
  }

  const parsed = Number(value);
  if (!Number.isInteger(parsed) || parsed < 1) {
    throw new Error('BACKGROUND_WORKER_CONCURRENCY must be a positive integer.');
  }

  return parsed;
}

/** Reusable producer configuration for every framework queue. */
export const DEFAULT_QUEUE_OPTIONS: Readonly<QueueOptions> = {
  connection: redisConnection,
  defaultJobOptions: DEFAULT_JOB_OPTIONS,
};

/**
 * Reusable worker configuration. It is deliberately exported now, but workers
 * are introduced only when a processor exists.
 */
export const DEFAULT_WORKER_OPTIONS: Readonly<WorkerOptions> = {
  connection: redisConnection,
  concurrency: readWorkerConcurrency(process.env.BACKGROUND_WORKER_CONCURRENCY),
  removeOnComplete: RETRY_POLICY.REMOVE_ON_COMPLETE,
  removeOnFail: RETRY_POLICY.REMOVE_ON_FAIL,
};
