import { PROCESSOR_NAMES } from '../constants/processor-names.constant';
import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { WorkerDefinition } from '../interfaces/worker.interface';
import type { ProcessorResolver } from '../managers/ProcessorResolver';
import { emailWorkerDefinition } from './email.worker';
import { imageWorkerDefinition } from './image.worker';
import { locationWorkerDefinition } from './location.worker';
import { notificationWorkerDefinition } from './notification.worker';
import { createWorkerProcessor } from './worker-processor.factory';
import { reportWorkerDefinition } from './report.worker';
import { systemWorkerDefinition } from './system.worker';

const maintenanceWorkerDefinition: WorkerDefinition = {
	id: 'maintenance-worker',
	name: 'Maintenance Worker',
	queue: QUEUE_NAMES.MAINTENANCE,
};

export {
	emailWorkerDefinition,
	imageWorkerDefinition,
	locationWorkerDefinition,
	maintenanceWorkerDefinition,
	notificationWorkerDefinition,
	reportWorkerDefinition,
	systemWorkerDefinition,
};

export function createWorkerDefinitions(resolver: ProcessorResolver): ReadonlyArray<WorkerDefinition> {
	return [
		{
			...locationWorkerDefinition,
			processor: createWorkerProcessor({
				processorId: PROCESSOR_NAMES.LOCATION,
				resolver,
			}),
		},
		{
			...notificationWorkerDefinition,
			processor: createWorkerProcessor({
				processorId: PROCESSOR_NAMES.NOTIFICATION,
				resolver,
			}),
		},
		{
			...emailWorkerDefinition,
			processor: createWorkerProcessor({
				processorId: PROCESSOR_NAMES.EMAIL,
				resolver,
			}),
		},
		{
			...reportWorkerDefinition,
			processor: createWorkerProcessor({
				processorId: PROCESSOR_NAMES.REPORT,
				resolver,
			}),
		},
		{
			...imageWorkerDefinition,
			processor: createWorkerProcessor({
				processorId: PROCESSOR_NAMES.IMAGE,
				resolver,
			}),
		},
		{
			...maintenanceWorkerDefinition,
			processor: createWorkerProcessor({
				processorId: PROCESSOR_NAMES.MAINTENANCE,
				resolver,
			}),
		},
		{
			...systemWorkerDefinition,
			processor: createWorkerProcessor({
				processorId: PROCESSOR_NAMES.SYSTEM,
				resolver,
			}),
		},
	];
}
