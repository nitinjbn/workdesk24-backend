import type { Queue } from 'bullmq';
import type IORedis from 'ioredis';

import { ALL_QUEUE_NAMES, type QueueName } from '../constants/queue-names.constant';
import type { JobPayload } from '../interfaces/background-job.interface';
import type {
  BackgroundFrameworkHealth,
  FailedJobDetails,
  QueueHealth,
  QueueStatistics,
  WorkerHealth,
} from '../interfaces/monitoring.interface';
import { noopBackgroundJobLogger, type BackgroundJobLogger } from '../utils/logger.utils';
import { QueueManager } from './QueueManager';
import type { WorkerManager } from './WorkerManager';

interface MonitoringServiceOptions {
  readonly queueManager?: QueueManager;
  readonly workerManager?: WorkerManager;
  readonly redisConnection: IORedis;
  readonly logger?: BackgroundJobLogger;
}

/** Provides framework-only queue and worker monitoring snapshots. */
export class BackgroundJobMonitoringService {
  private readonly queueManager: QueueManager;

  private readonly workerManager?: WorkerManager;

  private readonly redisConnection: IORedis;

  private readonly logger: BackgroundJobLogger;

  public constructor(options: MonitoringServiceOptions) {
    this.queueManager = options.queueManager ?? QueueManager.getInstance();
    this.workerManager = options.workerManager;
    this.redisConnection = options.redisConnection;
    this.logger = options.logger ?? noopBackgroundJobLogger;
  }

  public async getQueueStatistics(): Promise<ReadonlyArray<QueueStatistics>> {
    const queues = this.getFrameworkQueues();
    return Promise.all(queues.map(async (queue) => this.getSingleQueueStatistics(queue)));
  }

  public async getQueueHealth(): Promise<ReadonlyArray<QueueHealth>> {
    const queues = this.getFrameworkQueues();

    return Promise.all(queues.map(async (queue) => {
      try {
        await queue.getJobCounts('active');
        return {
          queue: queue.name as QueueName,
          isHealthy: true,
        };
      } catch (error: unknown) {
        this.logger.error('Queue health check failed.', error, { queue: queue.name });
        return {
          queue: queue.name as QueueName,
          isHealthy: false,
          error: error instanceof Error ? error.message : String(error),
        };
      }
    }));
  }

  public getWorkerHealth(): WorkerHealth {
    if (this.workerManager === undefined) {
      return {
        isRunning: false,
        runningWorkerCount: 0,
      };
    }

    return {
      isRunning: this.workerManager.isRunning(),
      runningWorkerCount: this.workerManager.getRunningWorkerCount(),
    };
  }

  public async getFailedJobs(limitPerQueue: number = 20): Promise<ReadonlyArray<FailedJobDetails>> {
    const queues = this.getFrameworkQueues();

    const failedJobs = await Promise.all(queues.map(async (queue) => {
      const jobs = await queue.getFailed(0, Math.max(limitPerQueue - 1, 0));
      return jobs.map((job) => ({
        queue: queue.name as QueueName,
        id: String(job.id),
        name: job.name,
        failedReason: job.failedReason,
        attemptsMade: job.attemptsMade,
        attemptsConfigured: typeof job.opts.attempts === 'number' && job.opts.attempts > 0 ? job.opts.attempts : 1,
        timestamp: job.timestamp,
      }));
    }));

    return failedJobs.flat();
  }

  public async getFrameworkHealth(): Promise<BackgroundFrameworkHealth> {
    const statistics = await this.getQueueStatistics();
    const workerHealth = this.getWorkerHealth();

    return {
      redisConnected: this.redisConnection.status === 'ready',
      workerRunning: workerHealth.isRunning,
      queueCount: statistics.length,
      activeJobs: statistics.reduce((total, current) => total + current.active, 0),
      waitingJobs: statistics.reduce((total, current) => total + current.waiting, 0),
      failedJobs: statistics.reduce((total, current) => total + current.failed, 0),
    };
  }

  private getFrameworkQueues(): ReadonlyArray<Queue<JobPayload, unknown, string>> {
    return ALL_QUEUE_NAMES.map((queueName) => this.queueManager.getQueue(queueName));
  }

  private async getSingleQueueStatistics(queue: Queue<JobPayload, unknown, string>): Promise<QueueStatistics> {
    const counts = await queue.getJobCounts(
      'active',
      'wait',
      'failed',
      'completed',
      'delayed',
      'paused',
      'prioritized',
      'waiting-children',
    );

    return {
      queue: queue.name as QueueName,
      active: counts.active ?? 0,
      waiting: (counts.wait ?? 0) + (counts['waiting-children'] ?? 0),
      failed: counts.failed ?? 0,
      completed: counts.completed ?? 0,
      delayed: counts.delayed ?? 0,
      paused: counts.paused ?? 0,
      prioritized: counts.prioritized ?? 0,
    };
  }
}
