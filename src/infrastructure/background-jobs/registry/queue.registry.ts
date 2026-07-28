import {
  LEGACY_QUEUE_NAME_ALIASES,
  QUEUE_NAMES,
  type QueueIdentifier,
  type QueueName,
} from '../constants/queue-names.constant';
import { BackgroundJobValidationError } from '../errors/background-job.error';

/** Resolves and validates the queues supported by this framework deployment. */
export class QueueRegistry {
  private readonly queueNames = new Set<QueueName>(Object.values(QUEUE_NAMES));

  public resolve(queue: QueueIdentifier): QueueName {
    if (this.queueNames.has(queue as QueueName)) {
      return queue as QueueName;
    }

    const legacyQueue = LEGACY_QUEUE_NAME_ALIASES[queue as keyof typeof LEGACY_QUEUE_NAME_ALIASES];
    if (legacyQueue !== undefined) {
      return legacyQueue;
    }

    throw new BackgroundJobValidationError(`Queue "${queue}" is not registered.`);
  }
}
