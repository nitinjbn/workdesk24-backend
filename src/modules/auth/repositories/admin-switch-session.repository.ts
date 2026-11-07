import { Transaction } from 'sequelize';
import AdminSwitchSession from '../../../models/schemas/AdminSwitchSession';

export interface CreateAdminSwitchSessionInput {
  switchSessionId: string;
  userId: number;
  originalHostId: number;
  sourceTokenFamily: string;
  currentHostId: number;
  tokenFamily: string;
  deviceId: string;
  contextVersion: number;
  startedAt: number;
  createdAt: number;
  updatedAt: number;
}

export class AdminSwitchSessionRepository {
  async create(
    data: CreateAdminSwitchSessionInput,
    transaction: Transaction
  ): Promise<AdminSwitchSession> {
    return AdminSwitchSession.create(data, { transaction });
  }

  async findBySwitchSessionId(
    switchSessionId: string,
    options: { transaction?: Transaction; lock?: boolean } = {}
  ): Promise<AdminSwitchSession | null> {
    return AdminSwitchSession.findOne({
      where: { switchSessionId, isActive: 1, isDeleted: 0 },
      transaction: options.transaction,
      lock: options.lock && options.transaction ? options.transaction.LOCK.UPDATE : undefined,
    });
  }

  async findActiveBySourceSession(
    userId: number,
    sourceTokenFamily: string,
    transaction: Transaction
  ): Promise<AdminSwitchSession[]> {
    return AdminSwitchSession.findAll({
      where: { userId, sourceTokenFamily, isActive: 1, isDeleted: 0 },
      order: [['id', 'ASC']],
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  async update(
    session: AdminSwitchSession,
    data: Partial<AdminSwitchSession>,
    transaction: Transaction
  ): Promise<void> {
    await session.update(data, { transaction });
  }
}

export default new AdminSwitchSessionRepository();