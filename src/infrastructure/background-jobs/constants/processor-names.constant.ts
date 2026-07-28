export const PROCESSOR_NAMES = {
  LOCATION: 'location-processor',
  NOTIFICATION: 'notification-processor',
  EMAIL: 'email-processor',
  IMAGE: 'image-processor',
  REPORT: 'report-processor',
} as const;

export type ProcessorName = (typeof PROCESSOR_NAMES)[keyof typeof PROCESSOR_NAMES];
