import type { Job } from 'bullmq';

import { BackgroundJobValidationError } from '../errors/background-job.error';
import type { JobPayload } from '../interfaces/background-job.interface';
import type { ProcessorDefinition } from '../interfaces/processor.interface';
import { ProcessorRegistry } from './ProcessorRegistry';

/** Resolves processors at runtime and executes them for workers. */
export class ProcessorResolver {
  public constructor(private readonly registry: ProcessorRegistry) {}

  public resolve(processorId: string): ProcessorDefinition {
    const processor = this.registry.resolve(processorId);
    if (processor === undefined) {
      throw new BackgroundJobValidationError(`Processor \"${processorId}\" is not registered.`);
    }

    return processor;
  }

  public async execute(job: Job<JobPayload, unknown, string>, processorId: string): Promise<unknown> {
    const processor = this.resolve(processorId);
    return processor.process(job);
  }
}
