import { maintenanceQueue } from '../queues/maintenance.queue';
import { CronHelper } from './cron.helper';

export async function registerMaintenanceSchedulers(): Promise<void> {
  await maintenanceQueue.upsertJobScheduler(
    'ensure-api-log-partition', // Job name
    {
      pattern: CronHelper.toCron({
        frequency: 'daily',
        time: '1:00 AM',
      }),
      tz: 'UTC',
    },
    {
      name: 'ensure-api-log-partition', // Job name
      data: {},
      opts: {
        attempts: 5, // Number of retry attempts (if the job fails)
        backoff: {
            type: 'exponential', // Backoff strategy (exponential), means the delay increases after each failure.
            delay: 60000, // Initial delay in milliseconds (60 seconds)
        },
        removeOnComplete: { // Remove completed jobs after a certain age or count
          age: 24 * 60 * 60,
          count: 100,
        },
        removeOnFail: { // Remove failed jobs after a certain age or count
          age: 7 * 24 * 60 * 60,
          count: 1000,
        },
      },
    },
  );

  console.log(
    '[Scheduler] Registered: ensure-api-log-partition (tz=UTC)',
  );
}