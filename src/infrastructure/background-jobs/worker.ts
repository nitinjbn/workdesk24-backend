import 'dotenv/config';

import { logger } from '../../config/database';
import { redisConnection } from './config/redis.config';
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

async function bootstrapWorker(): Promise<void> {
	await initializeRedis();

	const workerManager = new WorkerManager({
		redisConnection,
		logger: workerLogger,
	});

	const processorRegistry = new ProcessorRegistry();
	const frameworkProcessorRegistry = new FrameworkProcessorRegistry(workerLogger);
	frameworkProcessorRegistry.registerAll(processorRegistry);

	const processorResolver = new ProcessorResolver(processorRegistry);
	const workerRegistry = new WorkerRegistry(processorResolver);
	workerRegistry.registerAll(workerManager);

	workerManager.setupProcessHandlers();
	await workerManager.startAll();

	workerLogger.info('Background worker framework started successfully.', {
		registeredWorkers: workerManager.listRegisteredWorkers(),
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
