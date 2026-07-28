import type { QueueName } from '../constants/queue-names.constant';

export interface QueueStatistics {
  readonly queue: QueueName;
  readonly active: number;
  readonly waiting: number;
  readonly failed: number;
  readonly completed: number;
  readonly delayed: number;
  readonly paused: number;
  readonly prioritized: number;
}

export interface QueueHealth {
  readonly queue: QueueName;
  readonly isHealthy: boolean;
  readonly error?: string;
}

export interface WorkerHealth {
  readonly isRunning: boolean;
  readonly runningWorkerCount: number;
}

export interface BackgroundFrameworkHealth {
  readonly redisConnected: boolean;
  readonly workerRunning: boolean;
  readonly queueCount: number;
  readonly activeJobs: number;
  readonly waitingJobs: number;
  readonly failedJobs: number;
}

export interface FailedJobDetails {
  readonly queue: QueueName;
  readonly id: string;
  readonly name: string;
  readonly failedReason: string | undefined;
  readonly attemptsMade: number;
  readonly attemptsConfigured: number;
  readonly timestamp: number;
}

export interface QueueCleanupResult {
  readonly queue: QueueName;
  readonly status: QueueCleanupStatus;
  readonly removedCount: number;
}

export type QueueCleanupStatus =
  | 'completed'
  | 'wait'
  | 'active'
  | 'paused'
  | 'prioritized'
  | 'delayed'
  | 'failed';
