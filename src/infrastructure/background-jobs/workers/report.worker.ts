import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { WorkerDefinition } from '../interfaces/worker.interface';

export const reportWorkerDefinition: WorkerDefinition = {
	id: 'report-worker',
	name: 'Report Worker',
	queue: QUEUE_NAMES.REPORT,
};
