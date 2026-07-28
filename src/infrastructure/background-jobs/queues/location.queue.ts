import { JOB_NAMES } from '../constants/job-names.constant';
import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { BackgroundJobManager } from '../interfaces/background-job-manager.interface';
import type { BackgroundJobState } from '../interfaces/background-job-manager.interface';
import type { JobPayload } from '../interfaces/background-job.interface';
import type { ManagedBackgroundJob } from '../interfaces/background-job-manager.interface';
import type { QueueJobOptions } from '../interfaces/queue-job-options.interface';
import { backgroundJobManager } from '../managers/BackgroundJobManager';

export interface ResolveLocationPayload extends JobPayload {
	readonly hostId: number;
	readonly userId: number;
	readonly recordId: number;
	readonly entityType: string;
	readonly addressField: string;
	readonly latitude: number;
	readonly longitude: number;
	readonly requestedAt: string;
}

export type ResolveAttendanceLocationPayload = ResolveLocationPayload;

/**
 * Framework queue adapter used by feature modules to enqueue location jobs
 * without taking any dependency on BullMQ primitives.
 */
export class LocationQueue {
	public constructor(
		private readonly jobManager: BackgroundJobManager = backgroundJobManager,
	) {}

	public async dispatchResolveAttendanceLocation(
		payload: ResolveLocationPayload,
		options?: QueueJobOptions,
	): Promise<ManagedBackgroundJob<ResolveLocationPayload, typeof JOB_NAMES.RESOLVE_LOCATION>> {
		return this.dispatchResolveLocation(payload, options);
	}

	public async dispatchResolveLocation(
		payload: ResolveLocationPayload,
		options?: QueueJobOptions,
	): Promise<ManagedBackgroundJob<ResolveLocationPayload, typeof JOB_NAMES.RESOLVE_LOCATION>> {
		return this.jobManager.dispatch({
			queue: QUEUE_NAMES.LOCATION,
			job: JOB_NAMES.RESOLVE_LOCATION,
			payload,
			options,
		});
	}

	public async getJobState(jobId: string): Promise<BackgroundJobState | null> {
		return this.jobManager.getJobState(QUEUE_NAMES.LOCATION, jobId);
	}
}

export const locationQueue = new LocationQueue();
