import type { Job } from 'bullmq';

import { PROCESSOR_NAMES } from '../constants/processor-names.constant';
import type { JobPayload } from '../interfaces/background-job.interface';
import type { BaseProcessor } from '../interfaces/processor.interface';

export class EmailProcessor implements BaseProcessor<JobPayload, unknown> {
  public readonly id = PROCESSOR_NAMES.EMAIL;

  public async process(_job: Job<JobPayload, unknown, string>): Promise<unknown> {
    throw new Error('Email processor placeholder is not implemented yet.');
  }
}

export const emailProcessor = new EmailProcessor();
