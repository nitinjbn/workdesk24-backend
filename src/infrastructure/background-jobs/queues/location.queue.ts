import { JOB_NAMES } from '../constants/job-names.constant';
import { QUEUE_NAMES } from '../constants/queue-names.constant';
import type { BackgroundJobManager } from '../interfaces/background-job-manager.interface';
import type { BackgroundJobState } from '../interfaces/background-job-manager.interface';
import type { JobPayload } from '../interfaces/background-job.interface';
import type { ManagedBackgroundJob } from '../interfaces/background-job-manager.interface';
import { backgroundJobManager } from '../managers/BackgroundJobManager';

export interface ResolveAttendanceLocationPayload extends JobPayload {
	readonly attendanceId: string;
	readonly latitude: number;
	readonly longitude: number;
	readonly requestedAt: string;
}

/**
 * Framework queue adapter used by feature modules to enqueue location jobs
 * without taking any dependency on BullMQ primitives.
 */
export class LocationQueue {
	public constructor(
		private readonly jobManager: BackgroundJobManager = backgroundJobManager,
	) {}

	public async dispatchResolveAttendanceLocation(
		payload: ResolveAttendanceLocationPayload,
	): Promise<ManagedBackgroundJob<ResolveAttendanceLocationPayload, typeof JOB_NAMES.RESOLVE_ATTENDANCE_LOCATION>> {
		return this.jobManager.dispatch({
			queue: QUEUE_NAMES.LOCATION,
			job: JOB_NAMES.RESOLVE_ATTENDANCE_LOCATION,
			payload,
		});
	}

	public async getJobState(jobId: string): Promise<BackgroundJobState | null> {
		return this.jobManager.getJobState(QUEUE_NAMES.LOCATION, jobId);
	}
}

export const locationQueue = new LocationQueue();
