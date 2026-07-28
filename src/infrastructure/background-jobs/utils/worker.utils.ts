import type { Job, Worker } from 'bullmq';

import type { JobPayload } from '../interfaces/background-job.interface';
import type { WorkerProcessor } from '../interfaces/worker.interface';
import type { BackgroundJobLogger } from './logger.utils';

interface WorkerEventBindingOptions {
	readonly workerId: string;
	readonly workerName: string;
	readonly queueName: string;
	readonly logger: BackgroundJobLogger;
}

function getErrorMessage(error: unknown): string {
	if (error instanceof Error) {
		return error.message;
	}

	return String(error);
}

function getErrorStack(error: unknown): string | undefined {
	return error instanceof Error ? error.stack : undefined;
}

function getJobId(job: Job | undefined, fallback: string | undefined): string | undefined {
	if (job?.id === undefined) {
		return fallback;
	}

	return String(job.id);
}

function getMaxAttempts(job: Job | undefined): number {
	if (job?.opts.attempts !== undefined && Number.isInteger(job.opts.attempts) && job.opts.attempts > 0) {
		return job.opts.attempts;
	}

	return 1;
}

/**
 * Attach a standard event set to every worker so lifecycle behavior is
 * consistent across all queues.
 */
export function attachWorkerEventListeners(
	worker: Worker<JobPayload, unknown, string>,
	options: WorkerEventBindingOptions,
): void {
	const baseContext = {
		workerId: options.workerId,
		workerName: options.workerName,
		queue: options.queueName,
	};

	worker.on('completed', (job, result) => {
		options.logger.info('Worker job completed.', {
			...baseContext,
			jobId: getJobId(job, undefined),
			jobName: job.name,
			result,
		});
	});

	worker.on('failed', (job, error) => {
		const maxAttempts = getMaxAttempts(job);
		const attemptsMade = job?.attemptsMade ?? 0;

		options.logger.error('Worker job failed.', error, {
			...baseContext,
			jobId: getJobId(job, undefined),
			jobName: job?.name,
			attemptsMade,
			maxAttempts,
			errorMessage: getErrorMessage(error),
			errorStack: getErrorStack(error),
		});

		if (job !== undefined && attemptsMade < maxAttempts) {
			options.logger.info('Worker job retry scheduled.', {
				...baseContext,
				jobId: getJobId(job, undefined),
				jobName: job.name,
				attemptsMade,
				nextAttempt: attemptsMade + 1,
				maxAttempts,
			});
		}
	});

	worker.on('active', (job) => {
		options.logger.info('Worker job active.', {
			...baseContext,
			jobId: getJobId(job, undefined),
			jobName: job.name,
		});
	});

	const workerEventEmitter = worker as unknown as NodeJS.EventEmitter;
	workerEventEmitter.on('waiting', (jobId: string) => {
		options.logger.info('Worker job waiting.', {
			...baseContext,
			jobId,
		});
	});

	worker.on('stalled', (jobId) => {
		options.logger.info('Worker job stalled.', {
			...baseContext,
			jobId,
		});
	});

	worker.on('progress', (job, progress) => {
		options.logger.info('Worker job progress updated.', {
			...baseContext,
			jobId: getJobId(job, undefined),
			jobName: job.name,
			progress,
		});
	});

	worker.on('drained', () => {
		options.logger.info('Worker queue drained.', {
			...baseContext,
		});
	});
}

/**
 * Temporary processor used until a real processor is introduced for the queue.
 */
export function createPlaceholderProcessor(workerName: string): WorkerProcessor {
	return async (job) => {
		throw new Error(
			`Processor for worker "${workerName}" is not implemented yet (jobId=${String(job.id)}).`,
		);
	};
}
