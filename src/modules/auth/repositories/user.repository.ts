import { BaseRepository } from '../../../shared/repositories/base.repository';
import User from '../../../models/schemas/User';
import UserDevice from '../../../models/schemas/UserDevices';
import { WhereOptions } from 'sequelize';
import { UserOTP } from '../../../models';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';
import UserOTPDeliveries from '../../../models/schemas/UserOTPDeliveries';

export class UserRepository extends BaseRepository<typeof User.prototype> {
  constructor() {
    super(User as any);
  }

  async create(data: Partial<typeof User.prototype>): Promise<typeof User.prototype> {
    // Set default values (password hashing handled by model hook)
    const now = Math.floor(Date.now() / 1000);
    return this.model.create({
      ...data,
      role: (data as any).role || 'user',
      accountStatus: (data as any).accountStatus !== undefined ? (data as any).accountStatus : 'ACTIVE',
      lastLoginAt: (data as any).lastLoginAt || null,
      createdAt: now,
      updatedAt: now,
      isDeleted: 0,
      deletedAt: null,
    } as any);
  }

  async findByEmail(email: string): Promise<typeof User.prototype | null> {
    return this.findOne({ email } as WhereOptions<typeof User.prototype>);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.count({ email } as WhereOptions<typeof User.prototype>);
    return count > 0;
  }

  async findWithPassword(email: string): Promise<typeof User.prototype | null> {
    return this.model.findOne({
      where: { email, isDeleted: 0 } as WhereOptions<typeof User.prototype>,
      attributes: { include: ['password'] },
    });
  }

  async getUsersByFilter(filter: any): Promise<any> {
    if(!filter) {
      throw new Error('Filter is required');
    }
    const where:any = filter;
    
    // Ensure that isDeleted is always checked to be 0 unless explicitly provided in the filter
    if(!Object.prototype.hasOwnProperty.call(where, 'isDeleted')) {
      where.isDeleted = 0;
    }
    const users = await User.findAll({
      where,
      raw: true,
      logging: console.log, // Enable logging for debugging
    });
    return users || [];
  }

  async saveOtpForUser(payload: { hostId: number, userId: number; identifierType: string; identifierValue: string; otpCode: string; expiresAt: number; purpose: string; messageId?: string; maxAttempts: number; requestIp: string; createdAt: number; otpDeliveries: Array<{ deliveryChannel: string; destination: string; messageId?: string; provider?: string; status?: string | null; failedReason?: string | null, sentAt?: number | null }> }): Promise<any> {
    const { hostId, userId, identifierType, identifierValue, otpCode, expiresAt, purpose, maxAttempts, requestIp, createdAt, otpDeliveries } = payload;
    const createdOtpResult = await UserOTP.create({
      hostId,
      userId,
      identifierType,
      identifierValue,
      otpHash: otpCode, // Store the OTP code directly; hashing can be done in the model hook if needed
      expiresAt,
      purpose,
      maxAttempts,
      requestIp,
      createdAt
    });

    // Save OTP deliveries if provided
    if (otpDeliveries && otpDeliveries.length > 0) {
      const otpDeliveryRecords = otpDeliveries.map(delivery => ({
        hostId,
        userId,
        otpId: createdOtpResult.id,
        deliveryChannel: delivery.deliveryChannel,
        destination: delivery.destination,
        providerMessageId: delivery.messageId || null,
        provider: delivery.provider || null,
        status: delivery.status || 'PENDING',
        failureReason: delivery.failedReason || null,
        sentAt: delivery.sentAt || null,
        createdAt
      }));
      await UserOTPDeliveries.bulkCreate(otpDeliveryRecords);
    }

    return createdOtpResult;
  }

  async findLatestOtpByIdentifier(payload: {
    hostId: number;
    userId: number;
    purpose: string;
  }): Promise<typeof UserOTP.prototype | null> {
    const { hostId, userId, purpose } = payload;

    return UserOTP.findOne({
      where: {
        hostId,
        userId,
        purpose
      },
      order: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });
  }

  async incrementOtpAttempt(otpId: number): Promise<void> {
    await UserOTP.increment('attemptCount', {
      by: 1,
      where: { id: otpId },
    });
  }

  async updateOtpStatus(payload: {
    otpId: number;
    status: string;
    verifiedAt?: number | null;
  }): Promise<void> {
    const { otpId, status, verifiedAt } = payload;

    await UserOTP.update(
      {
        status,
        ...(verifiedAt !== undefined ? { verifiedAt } : {}),
      },
      {
        where: { id: otpId },
        individualHooks: true,
      }
    );
  }

  async updateUserDeviceDetails(payload: {
    hostId: number;
    userId: number;
    deviceId: string;
    deviceName?: string;
    deviceModel?: string;
    manufacturer?: string;
    brand?: string;
    device?: string;
    product?: string;
    hardware?: string | null;
    osVersion?: string;
    sdkInt?: number;
    appVersion?: string | null;
    storageTotalBytes?: number | null;
    storageAvailableBytes?: number | null;
    storageUsedBytes?: number | null;
    fcmToken?: string | null;
    createdAt?: number;
  }): Promise<UserDevice> {
    const { hostId, userId, deviceId, ...deviceData } = payload;

    if(!deviceData.createdAt) {
      deviceData.createdAt = DateTimeFormatUtil.getCurrentUnixTime();
    }

    // Try to find existing device record
    const existingDevice = await UserDevice.findOne({
      where: {
        hostId,
        userId,
        deviceId,
      },
    });

    if (existingDevice) {
      // Update existing record
      await existingDevice.update(deviceData);
      return existingDevice;
    } else {
      // Create new record
      return await UserDevice.create({
        hostId,
        userId,
        deviceId,
        ...deviceData,
      });
    }
  }
}

export default new UserRepository();
