import type { JobPayload } from '../interfaces/background-job.interface';
import type { ProcessorDefinition } from '../interfaces/processor.interface';

/**
 * Stores process-local processor instances. New processors are added by
 * registration only, keeping WorkerManager closed for modification.
 */
export class ProcessorRegistry {
  private readonly processors = new Map<string, ProcessorDefinition>();

  public register(processor: ProcessorDefinition): void {
    this.processors.set(processor.id, processor);
  }

  public registerAll(processors: ReadonlyArray<ProcessorDefinition>): void {
    for (const processor of processors) {
      this.register(processor);
    }
  }

  public has(processorId: string): boolean {
    return this.processors.has(processorId);
  }

  public resolve(processorId: string): ProcessorDefinition | undefined {
    return this.processors.get(processorId);
  }

  public listProcessorIds(): ReadonlyArray<string> {
    return [...this.processors.keys()];
  }
}
