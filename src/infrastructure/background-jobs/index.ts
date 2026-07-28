export { JOB_NAMES, type JobName } from './constants/job-names.constant';
export { JOB_PRIORITY, type JobPriority } from './constants/job-priority.constant';
export { PROCESSOR_NAMES, type ProcessorName } from './constants/processor-names.constant';
export {
  LEGACY_QUEUE_NAME_ALIASES,
  QUEUE_NAMES,
  type LegacyQueueName,
  type QueueIdentifier,
  type QueueName,
} from './constants/queue-names.constant';
export { RETRY_POLICY } from './constants/retry-policy.constant';
export { backgroundJobManager } from './managers/BackgroundJobManager';
export { BackgroundJobMonitoringService } from './managers/BackgroundJobMonitoringService';
export { BullBoardManager } from './managers/BullBoardManager';
export { ProcessorRegistry } from './managers/ProcessorRegistry';
export { ProcessorResolver } from './managers/ProcessorResolver';
export { WorkerManager } from './managers/WorkerManager';
export { BackgroundJobFrameworkError, BackgroundJobNotFoundError, BackgroundJobProviderError, BackgroundJobValidationError } from './errors/background-job.error';
export { FrameworkProcessorRegistry } from './registry/processor.registry';
export { WorkerRegistry } from './registry/worker.registry';
export type { BackgroundJob, BackgroundJobEnvelope, JobMetadata, JobPayload } from './interfaces/background-job.interface';
export type {
  BackgroundJobManager,
  BackgroundJobState,
  DeadLetterOptions,
  DispatchBulkRequest,
  DispatchRequest,
  JobProgress,
  JobStatusSnapshot,
  ManagedBackgroundJob,
  QueueDrainOptions,
  RetryFailedJobsOptions,
} from './interfaces/background-job-manager.interface';
export type { JobResult } from './interfaces/job-result.interface';
export type {
  BackgroundFrameworkHealth,
  FailedJobDetails,
  QueueCleanupResult,
  QueueCleanupStatus,
  QueueHealth,
  QueueStatistics,
  WorkerHealth,
} from './interfaces/monitoring.interface';
export type { BaseProcessor, ProcessorDefinition } from './interfaces/processor.interface';
export type { JobBackoffOptions, JobRetentionOptions, JobRetentionPolicy, QueueJobOptions } from './interfaces/queue-job-options.interface';
export type {
  RunningWorker,
  WorkerDefinition,
  WorkerProcessor,
} from './interfaces/worker.interface';
export {
  emailProcessor,
  createPlaceholderProcessors,
  imageProcessor,
  locationProcessor,
  notificationProcessor,
  placeholderProcessors,
  reportProcessor,
} from './processors';
export {
  LocationQueue,
  locationQueue,
  type ResolveLocationPayload,
  type ResolveAttendanceLocationPayload,
} from './queues';
export {
  emailWorkerDefinition,
  createWorkerDefinitions,
  imageWorkerDefinition,
  locationWorkerDefinition,
  notificationWorkerDefinition,
  reportWorkerDefinition,
} from './workers';
export { QueueCleanupUtils } from './utils/queue-cleanup.utils';
