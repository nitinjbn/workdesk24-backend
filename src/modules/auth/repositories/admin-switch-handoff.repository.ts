import { Transaction } from 'sequelize';
import AdminSwitchHandoff from '../../../models/schemas/AdminSwitchHandoff';

export interface CreateAdminSwitchHandoffInput {
  tokenHash: string;
  userId: number;
  tokenFamily: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
}

export class AdminSwitchHandoffRepository {
  async create(data: CreateAdminSwitchHandoffInput): Promise<AdminSwitchHandoff> {
    return AdminSwitchHandoff.create(data);
  }

  async findByTokenHash(
    tokenHash: string,
    transaction: Transaction,
    lock = false
  ): Promise<AdminSwitchHandoff | null> {
    return AdminSwitchHandoff.findOne({
      where: { tokenHash, isDeleted: 0 },
      transaction,
      lock: lock ? transaction.LOCK.UPDATE : undefined,
    });
  }
}

export default new AdminSwitchHandoffRepository();