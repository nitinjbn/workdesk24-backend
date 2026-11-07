import UserRefreshToken from '../../../models/schemas/UserRefreshToken';
import UserRefreshTokenHistory from '../../../models/schemas/UserRefreshTokenHistory';
import User from '../../../models/schemas/User';
import { Op, Transaction } from 'sequelize';
import { createConfiguredError } from '../../../shared/utils/error.util';
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
  switchSessionId?: string | null;
  contextVersion?: number | null;
}

interface RotateRefreshTokenInput extends CreateRefreshTokenInput {
  updatedAt: number;
  revokedAt: number;
  revokedReason: string;
}

type RotateRefreshTokenResult<T> =
  | { status: 'ROTATED'; value: T }
  | { status: 'REPLAY' | 'EXPIRED' | 'INVALID' | 'NOT_FOUND' };

type ReplaceSwitchSessionResult =
  | { status: 'REPLACED'; record: UserRefreshToken }
  | { status: 'EXPIRED' | 'STALE' };

export class UserRefreshTokenRepository {
  async create(data: CreateRefreshTokenInput, transaction?: Transaction): Promise<UserRefreshToken> {
    if (!data.createdAt) {
      data.createdAt = DateTimeFormatUtil.getCurrentUnixTime();
    }
    return UserRefreshToken.create(data, { transaction });
  }

  async replaceForDevice(
    data: CreateRefreshTokenInput,
    expectedPasswordHash?: string
  ): Promise<UserRefreshToken> {
    const sequelize = UserRefreshToken.sequelize;
    if (!sequelize) {
      throw new Error('Refresh-token model is not connected to Sequelize');
    }

    const now = Math.floor(Date.now() / 1000);
    return sequelize.transaction(async (transaction) => {
      const lockedUser = await User.findByPk(data.userId, {
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      // Guards against a login that validated its credentials just before a
      // concurrent password change committed: the hash observed at validation
      // must still match the hash on the locked user row.
      if (
        expectedPasswordHash !== undefined &&
        lockedUser?.password !== expectedPasswordHash
      ) {
        throw createConfiguredError('INVALID_CREDENTIALS');
      }

      const current = await UserRefreshToken.findOne({
        where: { hostId: data.hostId, userId: data.userId, deviceId: data.deviceId },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });

      if (!current) {
        return UserRefreshToken.create(data, { transaction });
      }

      await this.archiveToken(current, data.tokenHash, 'REPLACED_BY_LOGIN', now, transaction);
      await current.update(
        {
          ...data,
          isRevoked: 0,
          revokedAt: null,
          revokedReason: null,
          replacedByTokenHash: null,
          updatedAt: now,
        },
        { transaction }
      );

      return current;
    });
  }

  async rotateByTokenHash<T>(
    tokenHash: string,
    expected: {
      userId: number;
      tokenFamily: string;
      switchSessionId?: string;
      contextVersion?: number;
    },
    buildReplacement: (current: UserRefreshToken) => { data: RotateRefreshTokenInput; value: T },
    existingTransaction?: Transaction
  ): Promise<RotateRefreshTokenResult<T>> {
    const sequelize = UserRefreshToken.sequelize;
    if (!sequelize) {
      throw new Error('Refresh-token model is not connected to Sequelize');
    }

    const rotate = async (transaction: Transaction): Promise<RotateRefreshTokenResult<T>> => {
      const current = await UserRefreshToken.findOne({
        where: { tokenHash },
        transaction,
        lock: transaction.LOCK.UPDATE,
      });
      const now = Math.floor(Date.now() / 1000);

      if (!current) {
        const history = await UserRefreshTokenHistory.findOne({
          where: { tokenHash, isDeleted: 0 },
          transaction,
          lock: transaction.LOCK.UPDATE,
        });

        if (!history) {
          return { status: 'NOT_FOUND' };
        }

        if (
          (expected.switchSessionId && history.switchSessionId !== expected.switchSessionId) ||
          (expected.contextVersion !== undefined && history.contextVersion !== expected.contextVersion)
        ) {
          return { status: 'INVALID' };
        }

        await this.revokeActiveFamily(history.userId, history.tokenFamily, now, transaction);
        return { status: 'REPLAY' };
      }

      if (
        current.userId !== expected.userId ||
        current.tokenFamily !== expected.tokenFamily ||
        (expected.switchSessionId !== undefined &&
          current.switchSessionId !== expected.switchSessionId) ||
        (expected.contextVersion !== undefined &&
          current.contextVersion !== expected.contextVersion)
      ) {
        await this.revokeActiveFamily(current.userId, current.tokenFamily, now, transaction);
        return { status: 'INVALID' };
      }

      if (current.isRevoked === 1) {
        await this.revokeActiveFamily(current.userId, current.tokenFamily, now, transaction);
        return { status: 'REPLAY' };
      }

      if (current.expiresAt <= now) {
        await current.update(
          { isRevoked: 1, revokedAt: now, revokedReason: 'EXPIRED', updatedAt: now },
          { transaction }
        );
        return { status: 'EXPIRED' };
      }

      const replacement = buildReplacement(current);
      await this.archiveToken(
        current,
        replacement.data.tokenHash,
        replacement.data.revokedReason,
        replacement.data.revokedAt,
        transaction
      );
      await current.update(
        {
          ...replacement.data,
          isRevoked: 0,
          revokedAt: null,
          revokedReason: null,
          replacedByTokenHash: null,
        },
        { transaction }
      );

      return { status: 'ROTATED', value: replacement.value };
    };

    return existingTransaction ? rotate(existingTransaction) : sequelize.transaction(rotate);
  }

  async replaceForSwitchSession(
    expected: {
      switchSessionId: string;
      userId: number;
      tokenFamily: string;
      contextVersion: number;
    },
    replacement: RotateRefreshTokenInput,
    transaction: Transaction
  ): Promise<ReplaceSwitchSessionResult> {
    const current = await UserRefreshToken.findOne({
      where: {
        switchSessionId: expected.switchSessionId,
        userId: expected.userId,
        tokenFamily: expected.tokenFamily,
        isRevoked: 0,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });

    if (!current || current.contextVersion !== expected.contextVersion) {
      return { status: 'STALE' };
    }
    if (current.expiresAt <= Math.floor(Date.now() / 1000)) {
      return { status: 'EXPIRED' };
    }

    await this.archiveToken(
      current,
      replacement.tokenHash,
      replacement.revokedReason,
      replacement.revokedAt,
      transaction
    );
    await current.update(
      {
        ...replacement,
        isRevoked: 0,
        revokedAt: null,
        revokedReason: null,
        replacedByTokenHash: null,
      },
      { transaction }
    );

    return { status: 'REPLACED', record: current };
  }

  async findByTokenHash(
    tokenHash: string,
    transaction?: Transaction,
    lock = false
  ): Promise<UserRefreshToken | null> {
    return UserRefreshToken.findOne({
      where: { tokenHash },
      transaction,
      lock: transaction && lock ? transaction.LOCK.UPDATE : undefined,
    });
  }

  async findActiveByFamily(
    userId: number,
    tokenFamily: string,
    transaction?: Transaction,
    lock = true
  ): Promise<UserRefreshToken | null> {
    return UserRefreshToken.findOne({
      where: {
        userId,
        tokenFamily,
        deviceType: 'WEB',
        isRevoked: 0,
        expiresAt: { [Op.gt]: Math.floor(Date.now() / 1000) },
      },
      transaction,
      lock: transaction && lock ? transaction.LOCK.UPDATE : undefined,
    });
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

  async revokeActiveForFamily(
    userId: number,
    tokenFamily: string,
    transaction?: Transaction,
    reason = 'REUSE_DETECTED'
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await UserRefreshToken.update(
      { isRevoked: 1, revokedAt: now, revokedReason: reason, updatedAt: now },
      { where: { userId, tokenFamily, isRevoked: 0 }, transaction }
    );
  }

  async revokeActiveForUserExceptFamily(
    userId: number,
    keepTokenFamily: string | null,
    transaction: Transaction,
    reason: string
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await UserRefreshToken.update(
      { isRevoked: 1, revokedAt: now, revokedReason: reason, updatedAt: now },
      {
        where: {
          userId,
          isRevoked: 0,
          ...(keepTokenFamily ? { tokenFamily: { [Op.ne]: keepTokenFamily } } : {}),
        },
        transaction,
      }
    );
  }

  private async revokeActiveFamily(
    userId: number,
    tokenFamily: string,
    now: number,
    transaction: Transaction
  ): Promise<void> {
    await UserRefreshToken.update(
      { isRevoked: 1, revokedAt: now, revokedReason: 'REUSE_DETECTED', updatedAt: now },
      { where: { userId, tokenFamily, isRevoked: 0 }, transaction }
    );
  }

  private async archiveToken(
    token: UserRefreshToken,
    replacedByTokenHash: string,
    revokedReason: string,
    revokedAt: number,
    transaction: Transaction
  ): Promise<void> {
    await UserRefreshTokenHistory.create(
      {
        refreshTokenId: token.id,
        hostId: token.hostId,
        userId: token.userId,
        tokenHash: token.tokenHash,
        tokenFamily: token.tokenFamily,
        deviceType: token.deviceType,
        deviceId: token.deviceId,
        expiresAt: token.expiresAt,
        createdAt: token.createdAt,
        updatedAt: revokedAt,
        revokedAt,
        replacedByTokenHash,
        revokedReason,
        isDeleted: 0,
        deletedAt: null,
        ...(token.switchSessionId
          ? {
              switchSessionId: token.switchSessionId,
              contextVersion: token.contextVersion ?? null,
            }
          : {}),
      },
      { transaction }
    );
  }
}

export default new UserRefreshTokenRepository();
