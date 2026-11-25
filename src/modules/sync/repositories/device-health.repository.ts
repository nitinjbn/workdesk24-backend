import { Transaction } from 'sequelize';
import { UserDevice, UserDeviceHealth } from '../../../models';
import type UserDeviceHealthModel from '../../../models/schemas/UserDeviceHealth';
import type { UserDeviceHealthAttributes } from '../../../models/schemas/UserDeviceHealth';
import type { DeviceHealthInput } from '../types/device-health.schema';

export type DeviceHealthValues = Pick<UserDeviceHealthAttributes,
  'schemaVersion' | 'sequence' | 'collectedAt' | 'syncReason'
> & DeviceHealthInput['deviceInfo'] & DeviceHealthInput['permissions']
  & DeviceHealthInput['deviceSettings'] & DeviceHealthInput['trackingDiagnostics']
  & DeviceHealthInput['network'];

export class DeviceHealthRepository {
  async findDevice(hostId: number, userId: number, deviceId: string, transaction: Transaction) {
    return UserDevice.findOne({
      attributes: ['id', 'deviceId'],
      where: { hostId, userId, deviceId },
      transaction,
      lock: transaction.LOCK.UPDATE,
      logging: false,
    });
  }

  async findSnapshot(hostId: number, userId: number, deviceId: string, transaction: Transaction) {
    return UserDeviceHealth.findOne({
      where: { hostId, userId, deviceId },
      transaction,
      lock: transaction.LOCK.UPDATE,
      logging: false,
    });
  }

  async create(
    hostId: number, userId: number, deviceId: string, values: DeviceHealthValues,
    now: number, transaction: Transaction
  ) {
    return UserDeviceHealth.create({
      hostId, userId, deviceId, ...values, receivedAt: now, createdAt: now,
    }, { transaction, logging: false });
  }

  async update(
    snapshot: UserDeviceHealthModel, values: DeviceHealthValues, now: number, transaction: Transaction
  ) {
    await snapshot.update({ ...values, receivedAt: now, updatedAt: now }, {
      transaction, logging: false,
    });
  }
}

export default new DeviceHealthRepository();
