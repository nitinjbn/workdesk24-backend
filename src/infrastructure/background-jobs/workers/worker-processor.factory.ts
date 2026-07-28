import type { WorkerProcessor } from '../interfaces/worker.interface';
import type { ProcessorResolver } from '../managers/ProcessorResolver';

interface WorkerProcessorFactoryOptions {
  readonly processorId: string;
  readonly resolver: ProcessorResolver;
}

/** Builds worker-side processor delegates with resolver-based execution. */
export function createWorkerProcessor(options: WorkerProcessorFactoryOptions): WorkerProcessor {
  return async (job) => options.resolver.execute(job, options.processorId);
}
