import { sequelize } from '../../../models';
import { logger } from '../../../config/database';
import { createConfiguredError } from '../../../shared/utils/error.util';
import type { AuthUser } from '../../../shared/types/auth.types';
import type { DeviceHealthInput } from '../types/device-health.schema';
import type { UserDeviceHealthAttributes } from '../../../models/schemas/UserDeviceHealth';
import deviceHealthRepository, { type DeviceHealthValues } from '../repositories/device-health.repository';

export type DeviceHealthOutcome = 'created' | 'updated' | 'duplicate' | 'stale' | 'ambiguous' | 'deleted';

function snapshotMatches(snapshot: UserDeviceHealthAttributes, values: DeviceHealthValues): boolean {
  return Object.entries(values).every(([key, value]) => {
    const stored = snapshot[key as keyof DeviceHealthValues];
    if (value === null) return stored === null;
    if (typeof value === 'boolean') return stored === value || stored === Number(value);
    if (typeof value === 'number' && typeof stored === 'string') return stored === String(value);
    return stored === value;
  });
}

export class DeviceHealthService {
  async sync(user: Pick<AuthUser, 'id' | 'hostId'>, input: DeviceHealthInput): Promise<DeviceHealthOutcome> {
    if (input.hostId !== user.hostId || input.userId !== user.id) {
      throw createConfiguredError('DEVICE_HEALTH_IDENTITY_MISMATCH', 'Device health identity mismatch', 403, 'DEVICE_HEALTH_IDENTITY_MISMATCH');
    }

    const values: DeviceHealthValues = {
      schemaVersion: input.schemaVersion,
      sequence: input.sequence,
      collectedAt: input.collectedAt,
      syncReason: input.syncReason,
      ...input.deviceInfo,
      ...input.permissions,
      ...input.deviceSettings,
      ...input.trackingDiagnostics,
      ...input.network,
    };

    try {
      return await sequelize.transaction({ logging: false }, async (transaction) => {
        const device = await deviceHealthRepository.findDevice(user.hostId, user.id, input.deviceId, transaction);
        if (!device || device.deviceId !== input.deviceId) {
          throw createConfiguredError('DEVICE_HEALTH_DEVICE_NOT_REGISTERED', 'Device not registered', 403, 'DEVICE_HEALTH_DEVICE_NOT_REGISTERED');
        }

        const snapshot = await deviceHealthRepository.findSnapshot(user.hostId, user.id, input.deviceId, transaction);
        if (snapshot?.isDeleted) return 'deleted';
        if (snapshot && snapshotMatches(snapshot.get({ plain: true }), values)) return 'duplicate';
        if (snapshot) {
          const previousTime = BigInt(snapshot.collectedAt);
          const incomingTime = BigInt(input.collectedAt);
          if (incomingTime < previousTime) return 'stale';
          if (incomingTime === previousTime) return 'ambiguous';
        }

        const now = Math.floor(Date.now() / 1000);
        if (!snapshot) {
          await deviceHealthRepository.create(user.hostId, user.id, input.deviceId, values, now, transaction);
          return 'created';
        }
        await deviceHealthRepository.update(snapshot, values, now, transaction);
        return 'updated';
      });
    } catch (error: unknown) {
      if (error instanceof Error && 'code' in error && error.code === 'DEVICE_HEALTH_DEVICE_NOT_REGISTERED') {
        throw error;
      }
      logger.error('Device health persistence failed', {
        errorType: error instanceof Error ? error.name : 'UnknownError',
      });
      throw createConfiguredError('DEVICE_HEALTH_UNAVAILABLE', 'Device health synchronization temporarily unavailable', 500, 'DEVICE_HEALTH_UNAVAILABLE');
    }
  }
}

export default new DeviceHealthService();
