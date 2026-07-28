import type { WorkerManager } from '../managers/WorkerManager';
import type { ProcessorResolver } from '../managers/ProcessorResolver';
import { createWorkerDefinitions } from '../workers';

/** Central registry that knows which worker definitions belong to this process. */
export class WorkerRegistry {
	public constructor(private readonly processorResolver: ProcessorResolver) {}

	public registerAll(workerManager: WorkerManager): void {
		workerManager.registerAll(createWorkerDefinitions(this.processorResolver));
	}
}
