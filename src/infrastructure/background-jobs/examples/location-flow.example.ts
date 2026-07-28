import type IORedis from 'ioredis';

import { JOB_NAMES } from '../constants/job-names.constant';
import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { ResolveAttendanceLocationPayload } from '../queues';
import { LocationQueue } from '../queues';
import { backgroundJobManager } from '../managers/BackgroundJobManager';
import { ProcessorRegistry } from '../managers/ProcessorRegistry';
import { ProcessorResolver } from '../managers/ProcessorResolver';
import { WorkerManager } from '../managers/WorkerManager';
import { FrameworkProcessorRegistry } from '../registry/processor.registry';
import { WorkerRegistry } from '../registry/worker.registry';
import type { BackgroundJobLogger } from '../utils/logger.utils';

interface LocationFlowDependencies {
  readonly redisConnection: IORedis;
  readonly logger: BackgroundJobLogger;
  readonly timeoutMs?: number;
}

async function ensureRedisConnected(redisConnection: IORedis): Promise<void> {
  if (redisConnection.status === 'ready') {
    return;
  }

  if (redisConnection.status === 'connecting') {
    await new Promise<void>((resolve, reject) => {
      redisConnection.once('ready', () => {
        resolve();
      });
      redisConnection.once('error', (error: Error) => {
        reject(error);
      });
    });
    return;
  }

  await redisConnection.connect();
}

/**
 * End-to-end framework-only example:
 * feature-module enqueue -> queue -> worker -> processor -> payload log.
 */
export async function runLocationFlowExample(
  payload: ResolveAttendanceLocationPayload,
  dependencies: LocationFlowDependencies,
): Promise<void> {
  await ensureRedisConnected(dependencies.redisConnection);

  const workerManager = new WorkerManager({
    redisConnection: dependencies.redisConnection,
    logger: dependencies.logger,
  });
  const queue = new LocationQueue(backgroundJobManager);

  const processorRegistry = new ProcessorRegistry();
  const frameworkProcessorRegistry = new FrameworkProcessorRegistry(dependencies.logger);
  frameworkProcessorRegistry.registerAll(processorRegistry);

  const processorResolver = new ProcessorResolver(processorRegistry);
  const workerRegistry = new WorkerRegistry(processorResolver);
  workerRegistry.registerAll(workerManager);

  await workerManager.startAll();

  try {
    const dispatchedJob = await queue.dispatchResolveAttendanceLocation(payload);

    const timeoutMs = dependencies.timeoutMs ?? 10_000;
    const startedAt = Date.now();
    while (Date.now() - startedAt < timeoutMs) {
      const state = await queue.getJobState(dispatchedJob.id);
      if (state === 'completed') {
        dependencies.logger.info('Location flow example completed.', {
          queue: QUEUE_NAMES.LOCATION,
          jobId: dispatchedJob.id,
          jobName: JOB_NAMES.RESOLVE_ATTENDANCE_LOCATION,
        });
        return;
      }

      if (state === 'failed') {
        throw new Error(`Location flow example failed for job ${dispatchedJob.id}.`);
      }

      await new Promise<void>((resolve) => {
        setTimeout(resolve, 200);
      });
    }

    throw new Error(`Location flow example timed out after ${timeoutMs}ms.`);
  } finally {
    await workerManager.stopAll();
  }
}
