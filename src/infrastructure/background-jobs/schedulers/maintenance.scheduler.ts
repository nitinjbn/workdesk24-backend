import { maintenanceQueue } from '../queues/maintenance.queue';
import { CronHelper } from './cron.helper';

export async function registerMaintenanceSchedulers(): Promise<void> {
  // Register a cron job to ensure API log partitioning
  await maintenanceQueue.upsertJobScheduler(
    'ensure-api-log-partition', // Job name
    {
      pattern: CronHelper.toCron({
        frequency: 'weekly', // Frequency of the cron job (daily, weekly, monthly)
        day: 'sunday', // Day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        time: '1:00 AM',
      }),
      tz: 'Asia/Kolkata', // Timezone for the cron job, UTC or American/New_York or Asia/Kolkata, etc. (default is UTC)
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
  console.log('[Scheduler] Registered: ensure-api-log-partition');

  // Register a cron job to ensure API log partitioning
  await maintenanceQueue.upsertJobScheduler(
    'ensure-activity-log-partition', // Job name
    {
      pattern: CronHelper.toCron({
        frequency: 'weekly', // Frequency of the cron job (daily, weekly, monthly)
        day: 'sunday', // Day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday)
        time: '1:30 AM',
      }),
      tz: 'Asia/Kolkata', // Timezone for the cron job, UTC or American/New_York or Asia/Kolkata, etc. (default is UTC)
    },
    {
      name: 'ensure-activity-log-partition', // Job name
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
  console.log('[Scheduler] Registered: ensure-activity-log-partition');

  // Register a cron job to ensure GPS history partitioning
  await maintenanceQueue.upsertJobScheduler(
    'ensure-gps-history-partition', // Job name
    {
      pattern: CronHelper.toCron({
        frequency: 'weekly', // Frequency of the cron job (daily, weekly, monthly)
        day: 'sunday', // Day of the week (0 = Sunday, 1 = Monday, ..., 6 = Saturday or sunday, monday, tuesday, wednesday, thursday, friday, saturday)
        time: '2:00 AM',
      }),
      tz: 'Asia/Kolkata', // Timezone for the cron job, UTC or American/New_York or Asia/Kolkata, etc. (default is UTC)
    },
    {
      name: 'ensure-gps-history-partition', // Job name
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
  console.log('[Scheduler] Registered: ensure-gps-history-partition');
}