import type { ManagedBackgroundJob } from '../interfaces/background-job-manager.interface';
import type { ResolveLocationPayload } from '../queues';
import { locationQueue } from '../queues';
import { ensureRedisConnectionReady } from '../config/redis.config';

export interface LocationResolutionTarget {
	readonly entityType: string;
	readonly addressField: string;
	readonly latitudeField: string;
	readonly longitudeField: string;
}

export interface LocationResolutionRequest extends LocationResolutionTarget {
	readonly hostId: number;
	readonly userId: number;
	readonly recordId: number;
	readonly record: Record<string, unknown>;
}

function isNonEmptyString(value: unknown): value is string {
	return typeof value === 'string' && value.trim() !== '';
}

function toFiniteNumber(value: unknown): number | null {
	if (typeof value === 'number' && Number.isFinite(value)) {
		return value;
	}

	if (typeof value === 'string' && value.trim() !== '') {
		const numericValue = Number(value);
		return Number.isFinite(numericValue) ? numericValue : null;
	}

	return null;
}

function buildJobId(request: LocationResolutionRequest, latitude: number, longitude: number): string {
	return [
		'location-resolution',
		request.entityType,
		request.hostId,
		request.userId,
		request.recordId,
		request.addressField,
		latitude,
		longitude,
	].join('|');
}

export class LocationResolutionService {
	public async schedule(
		request: LocationResolutionRequest,
	): Promise<ManagedBackgroundJob<ResolveLocationPayload, string> | null> {
		if (isNonEmptyString(request.record[request.addressField])) {
			return null;
		}

		const latitude = toFiniteNumber(request.record[request.latitudeField]);
		const longitude = toFiniteNumber(request.record[request.longitudeField]);

		if (latitude === null || longitude === null) {
			return null;
		}

		await ensureRedisConnectionReady();

		return locationQueue.dispatchResolveLocation(
			{
				hostId: request.hostId,
				userId: request.userId,
				recordId: request.recordId,
				entityType: request.entityType,
				addressField: request.addressField,
				latitude,
				longitude,
				requestedAt: new Date().toISOString(),
			},
			{
				jobId: buildJobId(request, latitude, longitude),
			},
		);
	}
}

export const locationResolutionService = new LocationResolutionService();