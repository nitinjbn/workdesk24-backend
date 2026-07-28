import type { Job } from 'bullmq';

import { PROCESSOR_NAMES } from '../constants/processor-names.constant';
import type { JobPayload } from '../interfaces/background-job.interface';
import type { BaseProcessor } from '../interfaces/processor.interface';

export class ImageProcessor implements BaseProcessor<JobPayload, unknown> {
	public readonly id = PROCESSOR_NAMES.IMAGE;

	public async process(_job: Job<JobPayload, unknown, string>): Promise<unknown> {
		throw new Error('Image processor placeholder is not implemented yet.');
	}
}

export const imageProcessor = new ImageProcessor();
