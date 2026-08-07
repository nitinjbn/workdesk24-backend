import { Queue } from 'bullmq';
import { redisConnection } from '../config/redis.config';
import { QUEUE_NAMES } from '../constants/queue-names.constant';

export const maintenanceQueue = new Queue(QUEUE_NAMES.MAINTENANCE, {
  connection: redisConnection,
});