import UserRefreshToken from '../../../models/schemas/UserRefreshToken';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

interface CreateRefreshTokenInput {
  hostId: number;
  userId: number;
  tokenHash: string;
  tokenFamily: string;
  deviceType: 'WEB' | 'ANDROID' | 'IOS';
  deviceId: string;
  deviceName?: string | null;
  appVersion?: string | null;
  lastUsedAt?: number | null;
  expiresAt: number;
  createdAt?: number;
}

export class UserRefreshTokenRepository {
  async create(data: CreateRefreshTokenInput): Promise<UserRefreshToken> {
    if(!data.createdAt) {
      data.createdAt = DateTimeFormatUtil.getCurrentUnixTime();
    }
    return UserRefreshToken.create(data);
  }

  async findByTokenHash(tokenHash: string): Promise<UserRefreshToken | null> {
    return UserRefreshToken.findOne({ where: { tokenHash } });
  }

  async revokeTokenById(id: number, replacedByTokenHash?: string): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await UserRefreshToken.update(
      {
        isRevoked: 1,
        revokedAt: now,
        replacedByTokenHash: replacedByTokenHash || null,
      },
      { where: { id } }
    );
  }

  async revokeAllActiveForUser(userId: number): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await UserRefreshToken.update(
      {
        isRevoked: 1,
        revokedAt: now,
      },
      {
        where: {
          userId,
          isRevoked: 0,
        },
      }
    );
  }

  async revokeTokenByDevice(hostId: number, userId: number, deviceId: string): Promise<void> {
    // Delete existing token for this device to avoid unique constraint violation
    await UserRefreshToken.destroy({
      where: {
        hostId,
        userId,
        deviceId,
      },
    });
  }
}

export default new UserRefreshTokenRepository();
