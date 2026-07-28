/** JSON-serializable payload accepted by the job framework. */
export type JobPayload = Record<string, unknown>;

/** Metadata added by the framework to every dispatched job. */
export interface JobMetadata extends Record<string, unknown> {
  readonly correlationId: string;
  readonly requestId?: string;
  readonly createdAt: string;
  readonly frameworkVersion: string;
}

/** Stored job data. Feature payloads are kept separate from framework metadata. */
export interface BackgroundJobEnvelope<TPayload extends JobPayload = JobPayload> extends JobPayload {
  readonly payload: TPayload;
  readonly metadata: JobMetadata;
}

export interface BackgroundJob<TData extends JobPayload = JobPayload, TName extends string = string> {
  readonly name: TName;
  readonly data: TData;
}
