import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { WorkerDefinition } from '../interfaces/worker.interface';

export const imageWorkerDefinition: WorkerDefinition = {
	id: 'image-worker',
	name: 'Image Worker',
	queue: QUEUE_NAMES.IMAGE,
};
