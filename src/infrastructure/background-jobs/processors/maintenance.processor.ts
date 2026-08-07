import { Job } from 'bullmq';
import { apiLogService } from '../../../modules/api-logs/services/api-log.service';
import { PROCESSOR_NAMES } from '../constants/processor-names.constant';
import type { JobPayload } from '../interfaces/background-job.interface';
import type { BaseProcessor } from '../interfaces/processor.interface';

interface MaintenanceProcessorResult {
  readonly acknowledged: true;
  readonly handled: 'ensure-api-log-partition';
}

export class MaintenanceProcessor implements BaseProcessor<JobPayload, MaintenanceProcessorResult> {
  public readonly id = PROCESSOR_NAMES.MAINTENANCE;

  public async process(job: Job<JobPayload, MaintenanceProcessorResult, string>): Promise<MaintenanceProcessorResult> {
    switch (job.name) {
      case 'ensure-api-log-partition':
        await apiLogService.ensureNextPartition();
        return {
          acknowledged: true,
          handled: 'ensure-api-log-partition',
        };

      default:
        throw new Error(
          `Unknown maintenance job: ${job.name}`,
        );
    }
  }
}

export const maintenanceProcessor = new MaintenanceProcessor();

export async function processMaintenanceJob(
  job: Job,
): Promise<void> {
  await maintenanceProcessor.process(job as Job<JobPayload, MaintenanceProcessorResult, string>);
}