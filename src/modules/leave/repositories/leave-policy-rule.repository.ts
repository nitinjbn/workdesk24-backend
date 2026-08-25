import { BaseRepository } from '../../../shared/repositories/base.repository';
import { LeavePolicyRule, LeaveType } from '../../../models';
import { FindAndCountOptions, Op, Transaction, WhereOptions } from 'sequelize';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

type LeavePolicyRuleInstance = typeof LeavePolicyRule.prototype;

export class LeavePolicyRuleRepository extends BaseRepository<LeavePolicyRuleInstance> {
  constructor() {
    super(LeavePolicyRule as any);
  }

  async getPolicyRules(params: {
    hostId: number;
    leavePolicyId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: LeavePolicyRuleInstance[]; pagination?: any }> {
    const { hostId, leavePolicyId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      leavePolicyId,
      isDeleted: 0,
    };

    if (filter) {
      if (filter.leaveTypeId !== undefined) {
        where.leaveTypeId = filter.leaveTypeId;
      }
      if (filter.accrualType) {
        where.accrualType = filter.accrualType;
      }
      if (filter.isEnabled !== undefined) {
        where.isEnabled = filter.isEnabled;
      }
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: [
        'id',
        'leaveTypeId',
        'annualEntitlement',
        'accrualType',
        'minimumNoticeDays',
        'maximumAdvanceDays',
        'maximumConsecutiveDays',
        'isEnabled',
        'createdAt',
        'updatedAt',
      ],
      defaultOrder: [['createdAt', 'DESC']],
    });

    const query: FindAndCountOptions<any> = {
      where,
      order,
      include: [
        {
          model: LeaveType,
          as: 'leaveType',
          where: {
            hostId,
            isDeleted: 0,
          },
          required: false,
        },
      ],
    };

    const pagination = resolvePagination(page, limit);

    if (pagination) {
      query.limit = pagination.limit;
      query.offset = pagination.offset;

      const { rows, count } = await LeavePolicyRule.findAndCountAll(query);
      const total = Array.isArray(count) ? count.length : count;

      return {
        data: rows,
        pagination: buildPagination(total, pagination.page, pagination.limit),
      };
    }

    const rows = await LeavePolicyRule.findAll(query);
    return { data: rows };
  }

  async getRuleById(
    hostId: number,
    ruleId: number,
    transaction?: Transaction
  ): Promise<LeavePolicyRuleInstance | null> {
    return this.findOne(
      { hostId, id: ruleId } as WhereOptions<LeavePolicyRuleInstance>,
      transaction
    );
  }

  async getRuleByPolicyAndLeaveType(
    hostId: number,
    leavePolicyId: number,
    leaveTypeId: number,
    excludeRuleId?: number,
    transaction?: Transaction
  ): Promise<LeavePolicyRuleInstance | null> {
    const where: any = {
      hostId,
      leavePolicyId,
      leaveTypeId,
      isDeleted: 0,
      isEnabled: 1,
    };

    if (excludeRuleId) {
      where.id = {
        [Op.ne]: excludeRuleId,
      };
    }

    return LeavePolicyRule.findOne({ where, transaction });
  }

  async createRule(
    hostId: number,
    data: {
      leavePolicyId: number;
      leaveTypeId: number;
      annualEntitlement: number;
      accrualType: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
      allowCarryForward?: number;
      maxCarryForward?: number;
      allowEncashment?: number;
      allowHalfDay?: number;
      minimumNoticeDays?: number;
      maximumAdvanceDays?: number;
      maximumConsecutiveDays?: number;
      allowNegativeBalance?: number;
      requiresApproval?: number;
      isEnabled?: number;
    },
    transaction?: Transaction
  ): Promise<LeavePolicyRuleInstance> {
    const now = Math.floor(Date.now() / 1000);

    return LeavePolicyRule.create(
      {
        hostId,
        leavePolicyId: data.leavePolicyId,
        leaveTypeId: data.leaveTypeId,
        annualEntitlement: data.annualEntitlement,
        accrualType: data.accrualType,
        allowCarryForward: data.allowCarryForward || 0,
        maxCarryForward: data.maxCarryForward || 0,
        allowEncashment: data.allowEncashment || 0,
        allowHalfDay: data.allowHalfDay || 0,
        minimumNoticeDays: data.minimumNoticeDays || 0,
        maximumAdvanceDays: data.maximumAdvanceDays || 0,
        maximumConsecutiveDays: data.maximumConsecutiveDays || 0,
        allowNegativeBalance: data.allowNegativeBalance || 0,
        requiresApproval: data.requiresApproval || 0,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : 1,
        isDeleted: 0,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      } as any,
      { transaction }
    );
  }

  async createRulesBulk(
    hostId: number,
    rules: Array<{
      leavePolicyId: number;
      leaveTypeId: number;
      annualEntitlement: number;
      accrualType: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
      allowCarryForward?: number;
      maxCarryForward?: number;
      allowEncashment?: number;
      allowHalfDay?: number;
      minimumNoticeDays?: number;
      maximumAdvanceDays?: number;
      maximumConsecutiveDays?: number;
      allowNegativeBalance?: number;
      requiresApproval?: number;
      isEnabled?: number;
    }>,
    transaction: Transaction
  ): Promise<LeavePolicyRuleInstance[]> {
    const now = Math.floor(Date.now() / 1000);

    const payload = rules.map((rule) => ({
      hostId,
      leavePolicyId: rule.leavePolicyId,
      leaveTypeId: rule.leaveTypeId,
      annualEntitlement: rule.annualEntitlement,
      accrualType: rule.accrualType,
      allowCarryForward: rule.allowCarryForward || 0,
      maxCarryForward: rule.maxCarryForward || 0,
      allowEncashment: rule.allowEncashment || 0,
      allowHalfDay: rule.allowHalfDay || 0,
      minimumNoticeDays: rule.minimumNoticeDays || 0,
      maximumAdvanceDays: rule.maximumAdvanceDays || 0,
      maximumConsecutiveDays: rule.maximumConsecutiveDays || 0,
      allowNegativeBalance: rule.allowNegativeBalance || 0,
      requiresApproval: rule.requiresApproval || 0,
      isEnabled: rule.isEnabled !== undefined ? rule.isEnabled : 1,
      isDeleted: 0,
      deletedAt: null,
      createdAt: now,
      updatedAt: now,
    }));

    return LeavePolicyRule.bulkCreate(payload as any, { transaction });
  }

  async updateRule(
    hostId: number,
    ruleId: number,
    data: Partial<{
      leaveTypeId: number;
      annualEntitlement: number;
      accrualType: 'MONTHLY' | 'QUARTERLY' | 'HALF_YEARLY' | 'YEARLY';
      allowCarryForward: number;
      maxCarryForward: number;
      allowEncashment: number;
      allowHalfDay: number;
      minimumNoticeDays: number;
      maximumAdvanceDays: number;
      maximumConsecutiveDays: number;
      allowNegativeBalance: number;
      requiresApproval: number;
      isEnabled: number;
    }>,
    transaction?: Transaction
  ): Promise<LeavePolicyRuleInstance | null> {
    const rule = await this.getRuleById(hostId, ruleId, transaction);
    if (!rule) return null;

    const now = Math.floor(Date.now() / 1000);
    const updateData: any = {
      updatedAt: now,
    };

    Object.keys(data).forEach((key) => {
      if ((data as any)[key] !== undefined) {
        updateData[key] = (data as any)[key];
      }
    });

    await rule.update(updateData, { transaction });
    return rule;
  }

  async deleteRule(
    hostId: number,
    ruleId: number,
    transaction?: Transaction
  ): Promise<boolean> {
    const rule = await this.getRuleById(hostId, ruleId, transaction);
    if (!rule) return false;

    const now = Math.floor(Date.now() / 1000);
    await rule.update(
      {
        isDeleted: 1,
        deletedAt: now,
        updatedAt: now,
      } as any,
      { transaction }
    );

    return true;
  }

  async deleteRulesByPolicy(
    hostId: number,
    leavePolicyId: number,
    transaction?: Transaction
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await LeavePolicyRule.update(
      {
        isDeleted: 1,
        deletedAt: now,
        updatedAt: now,
      } as any,
      {
        where: {
          hostId,
          leavePolicyId,
          isDeleted: 0,
        },
        transaction,
      }
    );
  }

  async getRulesWithLeaveType(
    hostId: number,
    leavePolicyId: number,
    transaction?: Transaction
  ): Promise<LeavePolicyRuleInstance[]> {
    return LeavePolicyRule.findAll({
      where: {
        hostId,
        leavePolicyId,
        isDeleted: 0,
      },
      include: [
        {
          model: LeaveType,
          as: 'leaveType',
          where: {
            hostId,
            isDeleted: 0,
          },
          required: false,
        },
      ],
      order: [['createdAt', 'ASC']],
      transaction,
    });
  }

  async getActiveRulesWithEnabledLeaveType(
    hostId: number,
    leavePolicyId: number,
    transaction?: Transaction
  ): Promise<LeavePolicyRuleInstance[]> {
    return LeavePolicyRule.findAll({
      where: {
        hostId,
        leavePolicyId,
        isDeleted: 0,
        isEnabled: 1,
      },
      include: [
        {
          model: LeaveType,
          as: 'leaveType',
          where: {
            hostId,
            isDeleted: 0,
            isEnabled: 1,
          },
          required: true,
        },
      ],
      order: [['createdAt', 'ASC']],
      transaction,
    } as any);
  }
}

export default new LeavePolicyRuleRepository();
