import 'dotenv/config';

import { logger } from '../../config/database';
import { redisConnection } from './config/redis.config';
import { ALL_QUEUE_NAMES } from './constants/queue-names.constant';
import { BackgroundJobMonitoringService } from './managers/BackgroundJobMonitoringService';
import { ProcessorRegistry } from './managers/ProcessorRegistry';
import { ProcessorResolver } from './managers/ProcessorResolver';
import { WorkerManager } from './managers/WorkerManager';
import { FrameworkProcessorRegistry } from './registry/processor.registry';
import { WorkerRegistry } from './registry/worker.registry';
import type { BackgroundJobLogContext, BackgroundJobLogger } from './utils/logger.utils';

function serializeError(error: unknown): { message: string; stack?: string } {
	if (error instanceof Error) {
		return {
			message: error.message,
			stack: error.stack,
		};
	}

	return { message: String(error) };
}

const workerLogger: BackgroundJobLogger = {
	info(message: string, context?: BackgroundJobLogContext): void {
		logger.info(message, context ?? {});
	},
	error(message: string, error: unknown, context?: BackgroundJobLogContext): void {
		const serializedError = serializeError(error);
		logger.error(message, {
			...(context ?? {}),
			errorMessage: serializedError.message,
			errorStack: serializedError.stack,
		});
	},
};

async function initializeRedis(): Promise<void> {
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

function readHealthLogIntervalMs(value: string | undefined): number {
	if (value === undefined || value.trim() === '') {
		return 30000;
	}

	const parsed = Number(value);
	if (!Number.isInteger(parsed) || parsed < 5000) {
		throw new Error('BACKGROUND_WORKER_HEALTH_LOG_INTERVAL_MS must be an integer >= 5000.');
	}

	return parsed;
}

function getUnattachedQueues(registeredWorkerQueues: ReadonlyArray<string>): ReadonlyArray<string> {
	const registeredQueueSet = new Set(registeredWorkerQueues);
	return ALL_QUEUE_NAMES.filter((queueName) => !registeredQueueSet.has(queueName));
}

async function logFrameworkHealthSnapshot(monitoring: BackgroundJobMonitoringService): Promise<void> {
	const [queueStats, workerHealth, frameworkHealth] = await Promise.all([
		monitoring.getQueueStatistics(),
		Promise.resolve(monitoring.getWorkerHealth()),
		monitoring.getFrameworkHealth(),
	]);

	workerLogger.info('Background worker health snapshot.', {
		workerRunning: workerHealth.isRunning,
		runningWorkerCount: workerHealth.runningWorkerCount,
		redisStatus: redisConnection.status,
		frameworkHealth,
		queues: queueStats.map((queue) => ({
			queue: queue.queue,
			active: queue.active,
			waiting: queue.waiting,
			failed: queue.failed,
			delayed: queue.delayed,
			paused: queue.paused,
			prioritized: queue.prioritized,
			completed: queue.completed,
		})),
	});
}

async function bootstrapWorker(): Promise<void> {
	workerLogger.info('Bootstrapping background worker framework.', {
		pid: process.pid,
		nodeEnv: process.env.NODE_ENV,
		redisStatus: redisConnection.status,
	});

	await initializeRedis();
	workerLogger.info('Redis connection ready for worker bootstrap.', {
		redisStatus: redisConnection.status,
	});

	const workerManager = new WorkerManager({
		redisConnection,
		logger: workerLogger,
	});

	const processorRegistry = new ProcessorRegistry();
	const frameworkProcessorRegistry = new FrameworkProcessorRegistry(workerLogger);
	frameworkProcessorRegistry.registerAll(processorRegistry);
	workerLogger.info('Background processors registered.', {
		processorIds: processorRegistry.listProcessorIds(),
	});

	const processorResolver = new ProcessorResolver(processorRegistry);
	const workerRegistry = new WorkerRegistry(processorResolver);
	workerRegistry.registerAll(workerManager);

	const registeredWorkers = workerManager.listRegisteredWorkers();
	const unattachedQueues = getUnattachedQueues(registeredWorkers.map((worker) => worker.queue));
	workerLogger.info('Background workers attached to queues.', {
		workerCount: registeredWorkers.length,
		workers: registeredWorkers,
		unattachedQueues,
	});

	workerManager.setupProcessHandlers();
	await workerManager.startAll();

	workerLogger.info('Background worker framework started successfully.', {
		registeredWorkers,
		redisStatus: redisConnection.status,
	});

	const monitoring = new BackgroundJobMonitoringService({
		redisConnection,
		workerManager,
		logger: workerLogger,
	});

	await logFrameworkHealthSnapshot(monitoring);

	const healthLogIntervalMs = readHealthLogIntervalMs(process.env.BACKGROUND_WORKER_HEALTH_LOG_INTERVAL_MS);
	const healthTimer = setInterval(() => {
		void logFrameworkHealthSnapshot(monitoring).catch((error: unknown) => {
			workerLogger.error('Failed to capture background worker health snapshot.', error);
		});
	}, healthLogIntervalMs);
	healthTimer.unref();

	workerLogger.info('Background worker periodic health logging enabled.', {
		intervalMs: healthLogIntervalMs,
	});

	await new Promise<void>(() => undefined);
}

void bootstrapWorker().catch(async (error: unknown) => {
	workerLogger.error('Failed to bootstrap worker process.', error);

	try {
		await redisConnection.quit();
	} catch {
		redisConnection.disconnect();
	}

	process.exit(1);
});
