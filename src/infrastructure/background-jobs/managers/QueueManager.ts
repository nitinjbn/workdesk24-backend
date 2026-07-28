import { Queue, type QueueOptions } from 'bullmq';

import { DEFAULT_QUEUE_OPTIONS } from '../config/bullmq.config';
import {
  ALL_QUEUE_NAMES,
  LEGACY_QUEUE_NAME_ALIASES,
  type LegacyQueueName,
  type QueueIdentifier,
  type QueueName,
} from '../constants/queue-names.constant';
import type { JobPayload } from '../interfaces/background-job.interface';

type ManagedQueue = Queue<JobPayload, unknown, string>;

function isLegacyQueueName(name: QueueIdentifier): name is LegacyQueueName {
  return Object.prototype.hasOwnProperty.call(LEGACY_QUEUE_NAME_ALIASES, name);
}

function resolveQueueName(name: QueueIdentifier): QueueName {
  if (isLegacyQueueName(name)) {
    return LEGACY_QUEUE_NAME_ALIASES[name];
  }

  return name;
}

/**
 * Owns the process-local Queue cache. BullMQ queue handles are lightweight, but
 * reusing them prevents duplicate event listeners and connection bookkeeping.
 */
export class QueueManager {
  private static instance: QueueManager | undefined;

  private readonly queues = new Map<QueueName, ManagedQueue>();

  private constructor(private readonly defaultOptions: Readonly<QueueOptions> = DEFAULT_QUEUE_OPTIONS) {}

  public static getInstance(defaultOptions?: Readonly<QueueOptions>): QueueManager {
    if (QueueManager.instance === undefined) {
      QueueManager.instance = new QueueManager(defaultOptions);
    }

    return QueueManager.instance;
  }

  public getQueue<TData extends JobPayload = JobPayload, TResult = unknown, TName extends string = string>(name: QueueIdentifier): Queue<TData, TResult, TName> {
    const queueName = resolveQueueName(name);
    const existingQueue = this.queues.get(queueName);
    if (existingQueue !== undefined) {
      return existingQueue as unknown as Queue<TData, TResult, TName>;
    }

    const queue = new Queue<TData, TResult, TName>(queueName, {
      ...this.defaultOptions,
    });

    this.queues.set(queueName, queue as unknown as ManagedQueue);
    return queue;
  }

  public hasQueue(name: QueueIdentifier): boolean {
    return this.queues.has(resolveQueueName(name));
  }

  public getAllFrameworkQueues(): ReadonlyArray<ManagedQueue> {
    return ALL_QUEUE_NAMES.map((name) => this.getQueue(name));
  }

  public getInitializedQueueCount(): number {
    return this.queues.size;
  }

  public async close(): Promise<void> {
    const queues = [...this.queues.values()];
    this.queues.clear();
    await Promise.all(queues.map((queue) => queue.close()));
  }
}
