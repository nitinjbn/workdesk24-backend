/** Queues are partitioned by responsibility, never by job priority. */
export const QUEUE_NAMES = {
  LOCATION: 'background-location',
  NOTIFICATION: 'background-notification',
  EMAIL: 'background-email',
  IMAGE: 'background-image',
  REPORT: 'background-report',
  MAINTENANCE: 'maintenance',
  SYSTEM: 'background-system',
} as const;

export type QueueName = (typeof QUEUE_NAMES)[keyof typeof QUEUE_NAMES];

export const ALL_QUEUE_NAMES: ReadonlyArray<QueueName> = Object.values(QUEUE_NAMES);

/**
 * Temporary input compatibility for clients that used the original
 * priority-based queue values. QueueManager resolves each to SYSTEM so priority
 * no longer creates a separate queue. New code must use QUEUE_NAMES instead.
 */
export const LEGACY_QUEUE_NAME_ALIASES = {
  'background-default': QUEUE_NAMES.SYSTEM,
  'background-critical': QUEUE_NAMES.SYSTEM,
  'background-bulk': QUEUE_NAMES.SYSTEM,
} as const;

export type LegacyQueueName = keyof typeof LEGACY_QUEUE_NAME_ALIASES;
export type QueueIdentifier = QueueName | LegacyQueueName;
