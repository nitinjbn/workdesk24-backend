import type { Job } from 'bullmq';

import { PROCESSOR_NAMES } from '../constants/processor-names.constant';
import type { JobPayload } from '../interfaces/background-job.interface';
import type { BaseProcessor } from '../interfaces/processor.interface';

export class NotificationProcessor implements BaseProcessor<JobPayload, unknown> {
	public readonly id = PROCESSOR_NAMES.NOTIFICATION;

	public async process(_job: Job<JobPayload, unknown, string>): Promise<unknown> {
		throw new Error('Notification processor placeholder is not implemented yet.');
	}
}

export const notificationProcessor = new NotificationProcessor();
