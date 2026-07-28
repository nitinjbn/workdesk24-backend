export interface BackgroundJobLogContext extends Record<string, unknown> {
  readonly queue?: string;
  readonly jobId?: string;
  readonly jobName?: string;
}

/** Minimal logging boundary; adapters can connect this to the application logger later. */
export interface BackgroundJobLogger {
  info(message: string, context?: BackgroundJobLogContext): void;
  error(message: string, error: unknown, context?: BackgroundJobLogContext): void;
}

/** Safe default for applications that have not yet supplied a logger adapter. */
export const noopBackgroundJobLogger: BackgroundJobLogger = {
  info: () => undefined,
  error: () => undefined,
};
