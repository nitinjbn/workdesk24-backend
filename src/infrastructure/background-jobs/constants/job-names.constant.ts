/**
 * Generic lifecycle job names. Domain-specific job names belong to the domain
 * that owns them and can be added when a concrete job is implemented.
 */
export const JOB_NAMES = {
  EXECUTE: 'execute',
  RESOLVE_ATTENDANCE_LOCATION: 'resolve-attendance-location',
  DEAD_LETTER: 'dead-letter',
} as const;

export type JobName = (typeof JOB_NAMES)[keyof typeof JOB_NAMES];
