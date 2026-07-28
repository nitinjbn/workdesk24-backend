import { Worker, type WorkerOptions } from 'bullmq';
import type IORedis from 'ioredis';

import { DEFAULT_WORKER_OPTIONS } from '../config/bullmq.config';
import { QUEUE_NAMES, type QueueName } from '../constants/queue-names.constant';
import { BackgroundJobValidationError } from '../errors/background-job.error';
import type { JobPayload } from '../interfaces/background-job.interface';
import type { RunningWorker, WorkerDefinition, WorkerProcessor } from '../interfaces/worker.interface';
import {
	noopBackgroundJobLogger,
	type BackgroundJobLogger,
} from '../utils/logger.utils';
import {
	attachWorkerEventListeners,
	createPlaceholderProcessor,
} from '../utils/worker.utils';

interface WorkerManagerOptions {
	readonly defaultWorkerOptions?: Readonly<WorkerOptions>;
	readonly logger?: BackgroundJobLogger;
	readonly redisConnection: IORedis;
}

interface NormalizedWorkerDefinition {
	readonly id: string;
	readonly name: string;
	readonly queue: QueueName;
	readonly concurrency?: number;
	readonly processor: WorkerProcessor;
}

function isQueueName(value: string): value is QueueName {
	return Object.values(QUEUE_NAMES).includes(value as QueueName);
}

function normalizeError(error: unknown): Error {
	if (error instanceof Error) {
		return error;
	}

	return new Error(String(error));
}

/**
 * Owns worker process lifecycle: registration, start, stop, and graceful
 * shutdown hooks for process termination events.
 */
export class WorkerManager {
	private readonly definitions = new Map<string, NormalizedWorkerDefinition>();

	private readonly workers = new Map<string, Worker<JobPayload, unknown, string>>();

	private readonly defaultWorkerOptions: Readonly<WorkerOptions>;

	private readonly logger: BackgroundJobLogger;

	private readonly redisConnection: IORedis;

	private isStarted = false;

	private isShuttingDown = false;

	public constructor(options: WorkerManagerOptions) {
		this.defaultWorkerOptions = options.defaultWorkerOptions ?? DEFAULT_WORKER_OPTIONS;
		this.logger = options.logger ?? noopBackgroundJobLogger;
		this.redisConnection = options.redisConnection;
	}

	public register(definition: WorkerDefinition): void {
		this.ensureNotStarted();

		const normalizedDefinition = this.normalizeDefinition(definition);
		if (this.definitions.has(normalizedDefinition.id)) {
			throw new BackgroundJobValidationError(`Worker "${normalizedDefinition.id}" is already registered.`);
		}

		this.definitions.set(normalizedDefinition.id, normalizedDefinition);
		this.logger.info('Worker registered.', {
			workerId: normalizedDefinition.id,
			workerName: normalizedDefinition.name,
			queue: normalizedDefinition.queue,
			concurrency: normalizedDefinition.concurrency ?? this.defaultWorkerOptions.concurrency,
		});
	}

	public registerAll(definitions: ReadonlyArray<WorkerDefinition>): void {
		for (const definition of definitions) {
			this.register(definition);
		}
	}

	public listRegisteredWorkers(): ReadonlyArray<RunningWorker> {
		return [...this.definitions.values()].map((definition) => ({
			id: definition.id,
			name: definition.name,
			queue: definition.queue,
		}));
	}

	public isRunning(): boolean {
		return this.isStarted;
	}

	public getRunningWorkerCount(): number {
		return this.workers.size;
	}

	public async startAll(): Promise<void> {
		this.ensureNotStarted();

		for (const definition of this.definitions.values()) {
			const workerOptions: WorkerOptions = {
				...this.defaultWorkerOptions,
				concurrency: definition.concurrency ?? this.defaultWorkerOptions.concurrency,
			};

			const worker = new Worker<JobPayload, unknown, string>(
				definition.queue,
				definition.processor,
				workerOptions,
			);

			attachWorkerEventListeners(worker, {
				workerId: definition.id,
				workerName: definition.name,
				queueName: definition.queue,
				logger: this.logger,
			});

			this.workers.set(definition.id, worker);
			this.logger.info('Worker started.', {
				workerId: definition.id,
				workerName: definition.name,
				queue: definition.queue,
				concurrency: workerOptions.concurrency,
			});
		}

		this.isStarted = true;
	}

	public async stopAll(): Promise<void> {
		const workerEntries = [...this.workers.entries()];
		this.workers.clear();

		await Promise.all(workerEntries.map(async ([workerId, worker]) => {
			try {
				await worker.close();
				this.logger.info('Worker stopped.', { workerId });
			} catch (error: unknown) {
				this.logger.error('Failed to stop worker.', error, { workerId });
			}
		}));

		this.isStarted = false;
	}

	public setupProcessHandlers(): void {
		process.on('SIGINT', () => {
			void this.handleSignal('SIGINT');
		});

		process.on('SIGTERM', () => {
			void this.handleSignal('SIGTERM');
		});

		process.on('uncaughtException', (error: Error) => {
			void this.handleFatalError('uncaughtException', error);
		});

		process.on('unhandledRejection', (reason: unknown) => {
			void this.handleFatalError('unhandledRejection', normalizeError(reason));
		});
	}

	public async closeRedisConnection(): Promise<void> {
		const status = this.redisConnection.status;
		if (status === 'end') {
			return;
		}

		try {
			await this.redisConnection.quit();
			this.logger.info('Redis connection closed gracefully.');
		} catch (error: unknown) {
			this.logger.error('Redis quit failed; forcing disconnect.', error);
			this.redisConnection.disconnect();
		}
	}

	public async shutdown(reason: string): Promise<void> {
		if (this.isShuttingDown) {
			return;
		}

		this.isShuttingDown = true;
		this.logger.info('Worker shutdown started.', { reason });

		try {
			await this.stopAll();
			await this.closeRedisConnection();
			this.logger.info('Worker shutdown completed.', { reason });
		} finally {
			this.isShuttingDown = false;
		}
	}

	private async handleSignal(signal: 'SIGINT' | 'SIGTERM'): Promise<void> {
		await this.shutdown(signal);
		process.exit(0);
	}

	private async handleFatalError(eventName: 'uncaughtException' | 'unhandledRejection', error: Error): Promise<void> {
		this.logger.error('Worker process encountered a fatal error.', error, { eventName });
		await this.shutdown(eventName);
		process.exit(1);
	}

	private normalizeDefinition(definition: WorkerDefinition): NormalizedWorkerDefinition {
		const workerId = definition.id.trim();
		const workerName = definition.name.trim();
		const queueName = definition.queue.trim();

		if (workerId === '') {
			throw new BackgroundJobValidationError('Worker id is required.');
		}
		if (workerName === '') {
			throw new BackgroundJobValidationError('Worker name is required.');
		}
		if (!isQueueName(queueName)) {
			throw new BackgroundJobValidationError(`Worker queue "${definition.queue}" is not supported.`);
		}
		if (definition.concurrency !== undefined && (!Number.isInteger(definition.concurrency) || definition.concurrency < 1)) {
			throw new BackgroundJobValidationError('Worker concurrency must be a positive integer.');
		}

		return {
			id: workerId,
			name: workerName,
			queue: queueName,
			concurrency: definition.concurrency,
			processor: definition.processor ?? createPlaceholderProcessor(workerName),
		};
	}

	private ensureNotStarted(): void {
		if (this.isStarted) {
			throw new BackgroundJobValidationError('Workers are already started.');
		}
	}
}
