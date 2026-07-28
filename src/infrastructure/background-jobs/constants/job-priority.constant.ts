/** Named priorities for ordinary application use. Lower values run first. */
export const JOB_PRIORITY = {
  URGENT: 1,
  HIGH: 5,
  NORMAL: 10,
  LOW: 20,
} as const;

/** A provider-neutral priority value, validated by BackgroundJobManager. */
export type JobPriority = number;
