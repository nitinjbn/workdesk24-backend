import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { WorkerDefinition } from '../interfaces/worker.interface';

export const notificationWorkerDefinition: WorkerDefinition = {
	id: 'notification-worker',
	name: 'Notification Worker',
	queue: QUEUE_NAMES.NOTIFICATION,
};
