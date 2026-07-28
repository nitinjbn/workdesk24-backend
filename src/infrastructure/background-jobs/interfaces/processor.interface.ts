import type { Job } from 'bullmq';

import type { JobPayload } from './background-job.interface';

/** Base contract all processors must implement. */
export interface BaseProcessor<TData extends JobPayload = JobPayload, TResult = unknown> {
  readonly id: string;
  process(job: Job<TData, TResult, string>): Promise<TResult>;
}

/** Registry entry used to register processors in bulk without using "any". */
export type ProcessorDefinition = BaseProcessor<JobPayload, unknown>;
