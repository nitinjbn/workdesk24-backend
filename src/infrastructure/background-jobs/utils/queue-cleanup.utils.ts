import { ALL_QUEUE_NAMES, type QueueName } from '../constants/queue-names.constant';
import type { QueueCleanupResult, QueueCleanupStatus } from '../interfaces/monitoring.interface';
import { noopBackgroundJobLogger, type BackgroundJobLogger } from './logger.utils';
import { QueueManager } from '../managers/QueueManager';

interface QueueCleanupOptions {
  readonly graceMs?: number;
  readonly limit?: number;
}

/** Framework utility for queue cleanup operations with centralized logging. */
export class QueueCleanupUtils {
  public constructor(
    private readonly queueManager: QueueManager = QueueManager.getInstance(),
    private readonly logger: BackgroundJobLogger = noopBackgroundJobLogger,
  ) {}

  public async cleanQueue(
    queueName: QueueName,
    status: QueueCleanupStatus,
    options: QueueCleanupOptions = {},
  ): Promise<QueueCleanupResult> {
    const queue = this.queueManager.getQueue(queueName);
    const graceMs = options.graceMs ?? 0;
    const limit = options.limit ?? 1000;

    const removedJobs = await queue.clean(graceMs, limit, status);
    this.logger.info('Queue cleanup completed.', {
      queue: queueName,
      status,
      removedCount: removedJobs.length,
    });

    return {
      queue: queueName,
      status,
      removedCount: removedJobs.length,
    };
  }

  public async cleanAllQueues(
    status: QueueCleanupStatus,
    options: QueueCleanupOptions = {},
  ): Promise<ReadonlyArray<QueueCleanupResult>> {
    const results = await Promise.all(
      ALL_QUEUE_NAMES.map((queueName) => this.cleanQueue(queueName, status, options)),
    );

    this.logger.info('All queue cleanup completed.', {
      status,
      queueCount: results.length,
      totalRemoved: results.reduce((total, current) => total + current.removedCount, 0),
    });

    return results;
  }
}
