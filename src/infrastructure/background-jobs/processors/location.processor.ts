import type { Job } from 'bullmq';

import { PROCESSOR_NAMES } from '../constants/processor-names.constant';
import type { BackgroundJobEnvelope, JobPayload } from '../interfaces/background-job.interface';
import type { BaseProcessor } from '../interfaces/processor.interface';
import {
  noopBackgroundJobLogger,
  type BackgroundJobLogger,
} from '../utils/logger.utils';

interface LocationProcessorResult {
  readonly acknowledged: true;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}

export class LocationProcessor implements BaseProcessor<JobPayload, LocationProcessorResult> {
	public readonly id = PROCESSOR_NAMES.LOCATION;

	public constructor(
		private readonly logger: BackgroundJobLogger = noopBackgroundJobLogger,
	) {}

	public async process(job: Job<JobPayload, LocationProcessorResult, string>): Promise<LocationProcessorResult> {
		const envelope = job.data as BackgroundJobEnvelope<JobPayload>;
		const payload = isRecord(envelope.payload) ? envelope.payload : {};

		this.logger.info('Location processor received payload.', {
			queue: job.queueName,
			jobId: job.id === undefined ? undefined : String(job.id),
			jobName: job.name,
			payload,
		});

		return { acknowledged: true };
	}
}

export const locationProcessor = new LocationProcessor();
