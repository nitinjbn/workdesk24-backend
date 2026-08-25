import { BaseRepository } from '../../../shared/repositories/base.repository';
import { LeavePolicy, User } from '../../../models';
import { FindAndCountOptions, Op, Transaction, WhereOptions } from 'sequelize';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

type LeavePolicyInstance = typeof LeavePolicy.prototype;

export class LeavePolicyRepository extends BaseRepository<LeavePolicyInstance> {
  constructor() {
    super(LeavePolicy as any);
  }

  async getLeavePolicies(params: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: LeavePolicyInstance[]; pagination?: any }> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      isDeleted: 0,
    };

    if (filter) {
      if (filter.name) {
        where.name = {
          [Op.like]: `%${(filter.name as string).trim()}%`,
        };
      }
      if (filter.isDefault !== undefined) {
        where.isDefault = filter.isDefault;
      }
      if (filter.isEnabled !== undefined) {
        where.isEnabled = filter.isEnabled;
      }
      if (filter.effectiveFrom) {
        where.effectiveFrom = filter.effectiveFrom;
      }
      if (filter.effectiveTill) {
        where.effectiveTill = filter.effectiveTill;
      }
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: ['id', 'name', 'effectiveFrom', 'effectiveTill', 'isDefault', 'isEnabled', 'createdAt', 'updatedAt'],
      defaultOrder: [['createdAt', 'DESC']],
    });

    const query: FindAndCountOptions<any> = {
      where,
      order,
    };

    const pagination = resolvePagination(page, limit);

    if (pagination) {
      query.limit = pagination.limit;
      query.offset = pagination.offset;

      const { rows, count } = await LeavePolicy.findAndCountAll(query);

      return {
        data: rows,
        pagination: buildPagination(count, pagination.page, pagination.limit),
      };
    }

    const rows = await LeavePolicy.findAll(query);
    return { data: rows };
  }

  async getLeavePolicyById(
    hostId: number,
    leavePolicyId: number,
    transaction?: Transaction
  ): Promise<LeavePolicyInstance | null> {
    return this.findOne(
      { hostId, id: leavePolicyId } as WhereOptions<LeavePolicyInstance>,
      transaction
    );
  }

  async getLeavePolicyByName(
    hostId: number,
    name: string,
    excludeId?: number,
    transaction?: Transaction
  ): Promise<LeavePolicyInstance | null> {
    const where: any = {
      hostId,
      name: name.trim(),
      isDeleted: 0,
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    return LeavePolicy.findOne({ where, transaction });
  }

  async createLeavePolicy(
    hostId: number,
    data: {
      name: string;
      description?: string;
      effectiveFrom: string;
      effectiveTill?: string;
      isDefault?: number;
      isEnabled?: number;
    },
    transaction?: Transaction
  ): Promise<LeavePolicyInstance> {
    const now = Math.floor(Date.now() / 1000);

    return LeavePolicy.create(
      {
        hostId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        effectiveFrom: data.effectiveFrom,
        effectiveTill: data.effectiveTill || null,
        isDefault: data.isDefault || 0,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : 1,
        isDeleted: 0,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      } as any,
      { transaction }
    );
  }

  async updateLeavePolicy(
    hostId: number,
    leavePolicyId: number,
    data: Partial<{
      name: string;
      description: string;
      effectiveFrom: string;
      effectiveTill: string | null;
      isDefault: number;
      isEnabled: number;
    }>,
    transaction?: Transaction
  ): Promise<LeavePolicyInstance | null> {
    const policy = await this.getLeavePolicyById(hostId, leavePolicyId, transaction);
    if (!policy) return null;

    const now = Math.floor(Date.now() / 1000);
    const updateData: any = {
      updatedAt: now,
    };

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.effectiveFrom !== undefined) {
      updateData.effectiveFrom = data.effectiveFrom;
    }
    if (data.effectiveTill !== undefined) {
      updateData.effectiveTill = data.effectiveTill || null;
    }
    if (data.isDefault !== undefined) {
      updateData.isDefault = data.isDefault;
    }
    if (data.isEnabled !== undefined) {
      updateData.isEnabled = data.isEnabled;
    }

    await policy.update(updateData, { transaction });
    return policy;
  }

  async enableDisableLeavePolicy(
    hostId: number,
    leavePolicyId: number,
    isEnabled: number,
    transaction?: Transaction
  ): Promise<LeavePolicyInstance | null> {
    return this.updateLeavePolicy(hostId, leavePolicyId, { isEnabled }, transaction);
  }

  async setLeavePolicyAsDefault(
    hostId: number,
    leavePolicyId: number,
    transaction?: Transaction
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);

    await LeavePolicy.update(
      {
        isDefault: 0,
        updatedAt: now,
      } as any,
      {
        where: {
          hostId,
          isDeleted: 0,
          isDefault: 1,
        },
        transaction,
      }
    );

    await LeavePolicy.update(
      {
        isDefault: 1,
        updatedAt: now,
      } as any,
      {
        where: {
          hostId,
          id: leavePolicyId,
          isDeleted: 0,
        },
        transaction,
      }
    );
  }

  async deleteLeavePolicy(
    hostId: number,
    leavePolicyId: number,
    transaction?: Transaction
  ): Promise<boolean> {
    const policy = await this.getLeavePolicyById(hostId, leavePolicyId, transaction);
    if (!policy) return false;

    const now = Math.floor(Date.now() / 1000);
    await policy.update(
      {
        isDeleted: 1,
        deletedAt: now,
        updatedAt: now,
      } as any,
      { transaction }
    );

    return true;
  }

  async checkDependentAssignments(
    hostId: number,
    leavePolicyId: number
  ): Promise<number> {
    const count = await User.count({
      where: {
        hostId,
        leavePolicyId,
        isDeleted: 0,
      },
    } as any);

    return typeof count === 'number' ? count : 0;
  }
}

export default new LeavePolicyRepository();
