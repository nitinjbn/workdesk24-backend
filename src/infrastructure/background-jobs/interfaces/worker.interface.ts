import type { Job } from 'bullmq';

import type { QueueIdentifier } from '../constants/queue-names.constant';
import type { JobPayload } from './background-job.interface';

/** Function contract used by BullMQ workers for processing a single job. */
export type WorkerProcessor<TData extends JobPayload = JobPayload, TResult = unknown> = (
  job: Job<TData, TResult, string>,
) => Promise<TResult>;

/** Static metadata used by WorkerManager to build and run a worker. */
export interface WorkerDefinition<TData extends JobPayload = JobPayload, TResult = unknown> {
  readonly id: string;
  readonly name: string;
  readonly queue: QueueIdentifier;
  readonly concurrency?: number;
  readonly processor?: WorkerProcessor<TData, TResult>;
}

/** Runtime view of a registered worker once it has been started. */
export interface RunningWorker {
  readonly id: string;
  readonly name: string;
  readonly queue: QueueIdentifier;
}
