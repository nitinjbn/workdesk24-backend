import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { WorkerDefinition } from '../interfaces/worker.interface';

export const systemWorkerDefinition: WorkerDefinition = {
  id: 'system-worker',
  name: 'System Worker',
  queue: QUEUE_NAMES.SYSTEM,
};
