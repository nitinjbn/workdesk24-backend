import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { WorkerDefinition } from '../interfaces/worker.interface';

export const locationWorkerDefinition: WorkerDefinition = {
	id: 'location-worker',
	name: 'Location Worker',
	queue: QUEUE_NAMES.LOCATION,
};
