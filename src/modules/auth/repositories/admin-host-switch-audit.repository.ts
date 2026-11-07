import { Transaction } from 'sequelize';
import AdminHostSwitchAudit from '../../../models/schemas/AdminHostSwitchAudit';

export interface CreateAdminHostSwitchAuditInput {
  switchSessionId: string;
  originalUserId: number;
  originalHostId: number;
  previousHostId?: number | null;
  newHostId?: number | null;
  eventType: 'SWITCH' | 'SESSION_TERMINATED';
  contextVersion: number;
  requestIp?: string | null;
  userAgent?: string | null;
  createdAt: number;
  updatedAt: number;
}

export class AdminHostSwitchAuditRepository {
  async create(
    data: CreateAdminHostSwitchAuditInput,
    transaction: Transaction
  ): Promise<AdminHostSwitchAudit> {
    return AdminHostSwitchAudit.create(data, { transaction });
  }
}

export default new AdminHostSwitchAuditRepository();