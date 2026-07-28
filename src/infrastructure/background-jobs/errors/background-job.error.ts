/** Base error for failures produced by the background-job framework. */
export class BackgroundJobFrameworkError extends Error {
  public constructor(
    public readonly code: string,
    message: string,
    public readonly cause: unknown = undefined,
  ) {
    super(message);
    this.name = 'BackgroundJobFrameworkError';
  }
}

/** Raised when a caller supplies an invalid scheduling request. */
export class BackgroundJobValidationError extends BackgroundJobFrameworkError {
  public constructor(message: string) {
    super('BACKGROUND_JOB_VALIDATION_ERROR', message);
    this.name = 'BackgroundJobValidationError';
  }
}

/** Raised when an operation requires a job that cannot be found. */
export class BackgroundJobNotFoundError extends BackgroundJobFrameworkError {
  public constructor(queue: string, jobId: string) {
    super('BACKGROUND_JOB_NOT_FOUND', `Job "${jobId}" was not found in queue "${queue}".`);
    this.name = 'BackgroundJobNotFoundError';
  }
}

/** Wraps provider failures so BullMQ details never become the feature-module API. */
export class BackgroundJobProviderError extends BackgroundJobFrameworkError {
  public constructor(operation: string, cause: unknown) {
    const causeMessage = cause instanceof Error && typeof cause.message === 'string' && cause.message.trim() !== ''
      ? `: ${cause.message}`
      : '';

    super('BACKGROUND_JOB_PROVIDER_ERROR', `Unable to ${operation} background job work${causeMessage}.`, cause);
    this.name = 'BackgroundJobProviderError';
  }
}
