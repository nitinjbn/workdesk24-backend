import { BaseRepository } from '../../../shared/repositories/base.repository';
import { LeaveType, LeavePolicyRule, LeaveRequest, LeaveBalance } from '../../../models';
import { FindAndCountOptions, Op, WhereOptions, Transaction } from 'sequelize';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

type LeaveTypeInstance = typeof LeaveType.prototype;

export class LeaveTypeRepository extends BaseRepository<LeaveTypeInstance> {
  constructor() {
    super(LeaveType as any);
  }

  async getLeaveTypes(params: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: LeaveTypeInstance[]; pagination?: any }> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      isDeleted: 0,
    };

    // Apply filters
    if (filter) {
      if (filter.name) {
        where.name = {
          [Op.like]: `%${(filter.name as string).trim()}%`,
        };
      }
      if (filter.code) {
        where.code = {
          [Op.like]: `%${(filter.code as string).trim()}%`,
        };
      }
      if (filter.isPaid !== undefined) {
        where.isPaid = filter.isPaid;
      }
      if (filter.isEnabled !== undefined) {
        where.isEnabled = filter.isEnabled;
      }
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: ['id', 'name', 'code', 'isPaid', 'isEnabled', 'createdAt', 'updatedAt'],
      defaultOrder: [['name', 'ASC']],
    });

    const query: FindAndCountOptions<any> = {
      where,
      order,
      raw: true,
    };

    const pagination = resolvePagination(page, limit);

    if (pagination) {
      query.limit = pagination.limit;
      query.offset = pagination.offset;

      const { rows, count } = await LeaveType.findAndCountAll(query);

      return {
        data: rows,
        pagination: buildPagination(count, pagination.page, pagination.limit),
      };
    } else {
      const rows = await LeaveType.findAll(query);
      return { data: rows };
    }
  }

  async getLeaveTypeById(
    hostId: number,
    leaveTypeId: number,
    transaction?: Transaction
  ): Promise<LeaveTypeInstance | null> {
    return this.findOne(
      { hostId, id: leaveTypeId } as WhereOptions<LeaveTypeInstance>,
      transaction
    );
  }

  async getLeaveTypeByCode(
    hostId: number,
    code: string,
    excludeId?: number
  ): Promise<LeaveTypeInstance | null> {
    const where: any = {
      hostId,
      code: code.trim().toUpperCase(),
      isDeleted: 0,
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    return LeaveType.findOne({ where, raw: true } as any);
  }

  async createLeaveType(
    hostId: number,
    data: {
      name: string;
      code: string;
      description?: string;
      isPaid?: number;
      allowHalfDay?: number;
      allowPastDate?: number;
      allowFutureDate?: number;
      requiresDocument?: number;
      documentAfterDays?: number;
      color?: string;
    },
    transaction?: Transaction
  ): Promise<LeaveTypeInstance> {
    const now = Math.floor(Date.now() / 1000);

    return LeaveType.create(
      {
        hostId,
        name: data.name.trim(),
        code: data.code.trim().toUpperCase(),
        description: data.description?.trim() || null,
        isPaid: data.isPaid !== undefined ? data.isPaid : 1,
        allowHalfDay: data.allowHalfDay || 0,
        allowPastDate: data.allowPastDate || 0,
        allowFutureDate: data.allowFutureDate !== undefined ? data.allowFutureDate : 1,
        requiresDocument: data.requiresDocument || 0,
        documentAfterDays: data.documentAfterDays || null,
        color: data.color?.trim() || null,
        isEnabled: 1,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      } as any,
      { transaction }
    );
  }

  async updateLeaveType(
    hostId: number,
    leaveTypeId: number,
    data: Partial<{
      name: string;
      code: string;
      description: string;
      isPaid: number;
      allowHalfDay: number;
      allowPastDate: number;
      allowFutureDate: number;
      requiresDocument: number;
      documentAfterDays: number;
      color: string;
    }>,
    transaction?: Transaction
  ): Promise<LeaveTypeInstance | null> {
    const leaveType = await this.getLeaveTypeById(hostId, leaveTypeId, transaction);
    if (!leaveType) return null;

    const now = Math.floor(Date.now() / 1000);
    const updateData: any = { updatedAt: now };

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.code !== undefined) {
      updateData.code = data.code.trim().toUpperCase();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.isPaid !== undefined) {
      updateData.isPaid = data.isPaid;
    }
    if (data.allowHalfDay !== undefined) {
      updateData.allowHalfDay = data.allowHalfDay;
    }
    if (data.allowPastDate !== undefined) {
      updateData.allowPastDate = data.allowPastDate;
    }
    if (data.allowFutureDate !== undefined) {
      updateData.allowFutureDate = data.allowFutureDate;
    }
    if (data.requiresDocument !== undefined) {
      updateData.requiresDocument = data.requiresDocument;
    }
    if (data.documentAfterDays !== undefined) {
      updateData.documentAfterDays = data.documentAfterDays || null;
    }
    if (data.color !== undefined) {
      updateData.color = data.color?.trim() || null;
    }

    await leaveType.update(updateData, { transaction });
    return leaveType;
  }

  async enableDisableLeaveType(
    hostId: number,
    leaveTypeId: number,
    isEnabled: number,
    transaction?: Transaction
  ): Promise<LeaveTypeInstance | null> {
    const leaveType = await this.getLeaveTypeById(hostId, leaveTypeId, transaction);
    if (!leaveType) return null;

    const now = Math.floor(Date.now() / 1000);
    await leaveType.update(
      {
        isEnabled,
        updatedAt: now,
      } as any,
      { transaction }
    );

    return leaveType;
  }

  async deleteLeaveType(
    hostId: number,
    leaveTypeId: number,
    transaction?: Transaction
  ): Promise<boolean> {
    const leaveType = await this.getLeaveTypeById(hostId, leaveTypeId, transaction);
    if (!leaveType) return false;

    const now = Math.floor(Date.now() / 1000);
    await leaveType.update(
      {
        isDeleted: 1,
        deletedAt: now,
      } as any,
      { transaction }
    );

    return true;
  }

  async checkDependentRecords(
    hostId: number,
    leaveTypeId: number
  ): Promise<{ hasDependents: boolean; dependencyCount: number; details: Record<string, number> }> {
    // Check for leave policy rules
    const policyRuleCount = await LeavePolicyRule.count({
      where: {
        hostId,
        leaveTypeId,
        isDeleted: 0,
      },
    } as any);

    // Check for leave requests
    const leaveRequestCount = await LeaveRequest.count({
      where: {
        hostId,
        leaveTypeId,
        isDeleted: 0,
      },
    } as any);

    // Check for leave balances
    const leaveBalanceCount = await LeaveBalance.count({
      where: {
        hostId,
        leaveTypeId,
        isDeleted: 0,
      },
    } as any);

    const totalDependents =
      (typeof policyRuleCount === 'number' ? policyRuleCount : 0) +
      (typeof leaveRequestCount === 'number' ? leaveRequestCount : 0) +
      (typeof leaveBalanceCount === 'number' ? leaveBalanceCount : 0);

    return {
      hasDependents: totalDependents > 0,
      dependencyCount: totalDependents,
      details: {
        policyRules: typeof policyRuleCount === 'number' ? policyRuleCount : 0,
        leaveRequests: typeof leaveRequestCount === 'number' ? leaveRequestCount : 0,
        leaveBalances: typeof leaveBalanceCount === 'number' ? leaveBalanceCount : 0,
      },
    };
  }
}

export default new LeaveTypeRepository();
