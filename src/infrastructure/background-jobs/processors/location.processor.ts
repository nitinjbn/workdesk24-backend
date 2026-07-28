import type { Job } from 'bullmq';
import { QueryTypes } from 'sequelize';

import db from '../../../models';
import { PROCESSOR_NAMES } from '../constants/processor-names.constant';
import type { BackgroundJobEnvelope, JobPayload } from '../interfaces/background-job.interface';
import type { BaseProcessor } from '../interfaces/processor.interface';
import {
	reverseGeocodingService,
} from '../services/reverse-geocoding.service';
import {
	noopBackgroundJobLogger,
	type BackgroundJobLogger,
} from '../utils/logger.utils';

interface LocationProcessorResult {
	readonly acknowledged: true;
	readonly updated: boolean;
	readonly skipped?: string;
	readonly address?: string;
}

interface LocationEntityConfig {
	readonly tableName: string;
	readonly idColumn: string;
	readonly hostColumn: string;
	readonly userColumn: string;
}

interface ResolveLocationPayload extends JobPayload {
	readonly hostId: number;
	readonly userId: number;
	readonly recordId: number;
	readonly entityType: string;
	readonly addressField: string;
	readonly latitude: number;
	readonly longitude: number;
	readonly requestedAt: string;
}

const LOCATION_ENTITIES: Record<string, LocationEntityConfig> = {
	attendance: {
		tableName: 'wd_attendance',
		idColumn: 'id',
		hostColumn: 'hostId',
		userColumn: 'userId',
	},
};

function isRecord(value: unknown): value is Record<string, unknown> {
	return typeof value === 'object' && value !== null && !Array.isArray(value);
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

function resolveLocationEntity(entityType: string): LocationEntityConfig {
	const entity = LOCATION_ENTITIES[entityType];
	if (!entity) {
		throw new Error(`Location entity "${entityType}" is not registered.`);
	}

	return entity;
}

function quoteIdentifier(identifier: string): string {
	return `\`${identifier}\``;
}

export class LocationProcessor implements BaseProcessor<JobPayload, LocationProcessorResult> {
	public readonly id = PROCESSOR_NAMES.LOCATION;

	public constructor(
		private readonly logger: BackgroundJobLogger = noopBackgroundJobLogger,
	) {}

	public async process(job: Job<JobPayload, LocationProcessorResult, string>): Promise<LocationProcessorResult> {
		const envelope = job.data as BackgroundJobEnvelope<JobPayload>;
		const payload = isRecord(envelope.payload) ? envelope.payload as ResolveLocationPayload : null;

		if (!payload) {
			throw new Error('Location processor received an invalid payload.');
		}

		const entity = resolveLocationEntity(String(payload.entityType));
		const latitude = toFiniteNumber(payload.latitude);
		const longitude = toFiniteNumber(payload.longitude);

		if (latitude === null || longitude === null) {
			throw new Error('Latitude and longitude are required to resolve the location.');
		}

		const addressField = String(payload.addressField || '').trim();
		if (addressField === '') {
			throw new Error('addressField is required to resolve the location.');
		}

		const [existingRows] = await db.sequelize.query(
			`SELECT ${quoteIdentifier(addressField)} AS addressValue
			 FROM ${quoteIdentifier(entity.tableName)}
			 WHERE ${quoteIdentifier(entity.idColumn)} = :recordId
			   AND ${quoteIdentifier(entity.hostColumn)} = :hostId
			   AND ${quoteIdentifier(entity.userColumn)} = :userId
			 LIMIT 1`,
			{
				replacements: {
					recordId: payload.recordId,
					hostId: payload.hostId,
					userId: payload.userId,
				},
				type: QueryTypes.SELECT,
			},
		) as Array<{ addressValue?: unknown }>;

		const existingAddress = existingRows?.addressValue;
		if (isNonEmptyString(existingAddress)) {
			this.logger.info('Location already resolved for record; skipping update.', {
				entityType: payload.entityType,
				recordId: payload.recordId,
				addressField,
			});
			return { acknowledged: true, updated: false, skipped: 'already-resolved' };
		}

		const resolvedAddress = await reverseGeocodingService.resolveAddress(latitude, longitude);
		if (!resolvedAddress) {
			this.logger.info('No geocoding result found for location job.', {
				entityType: payload.entityType,
				recordId: payload.recordId,
				latitude,
				longitude,
			});
			return { acknowledged: true, updated: false, skipped: 'no-result' };
		}

		const now = Math.floor(Date.now() / 1000);
		const updateResult = await db.sequelize.query(
			`UPDATE ${quoteIdentifier(entity.tableName)}
			 SET ${quoteIdentifier(addressField)} = :resolvedAddress,
			     updatedAt = :updatedAt
			 WHERE ${quoteIdentifier(entity.idColumn)} = :recordId
			   AND ${quoteIdentifier(entity.hostColumn)} = :hostId
			   AND ${quoteIdentifier(entity.userColumn)} = :userId
			   AND (${quoteIdentifier(addressField)} IS NULL OR ${quoteIdentifier(addressField)} = '')`,
			{
				replacements: {
					resolvedAddress,
					updatedAt: now,
					recordId: payload.recordId,
					hostId: payload.hostId,
					userId: payload.userId,
				},
				type: QueryTypes.UPDATE,
			},
		);

		const didUpdate = Array.isArray(updateResult)
			? Number(updateResult[0]) > 0
			: false;
		this.logger.info('Location processor completed.', {
			entityType: payload.entityType,
			recordId: payload.recordId,
			addressField,
			updated: didUpdate,
		});

		return {
			acknowledged: true,
			updated: didUpdate,
			address: resolvedAddress,
		};
	}
}

export const locationProcessor = new LocationProcessor();
