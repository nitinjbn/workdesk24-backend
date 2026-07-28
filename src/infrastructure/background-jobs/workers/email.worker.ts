import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { WorkerDefinition } from '../interfaces/worker.interface';

export const emailWorkerDefinition: WorkerDefinition = {
	id: 'email-worker',
	name: 'Email Worker',
	queue: QUEUE_NAMES.EMAIL,
};
