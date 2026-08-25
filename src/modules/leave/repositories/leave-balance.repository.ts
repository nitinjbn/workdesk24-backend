import { FindAndCountOptions, Op, Transaction, WhereOptions } from 'sequelize';
import { LeaveBalance, LeaveType, LeaveYear, User } from '../../../models';
import { BaseRepository } from '../../../shared/repositories/base.repository';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

type LeaveBalanceInstance = typeof LeaveBalance.prototype;

export class LeaveBalanceRepository extends BaseRepository<LeaveBalanceInstance> {
  constructor() {
    super(LeaveBalance as any);
  }

  async getEmployeeLeaveBalances(params: {
    hostId: number;
    userId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: LeaveBalanceInstance[]; pagination?: any }> {
    const { hostId, userId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      userId,
      isDeleted: 0,
    };

    if (filter) {
      if (filter.leaveYearId !== undefined) {
        where.leaveYearId = filter.leaveYearId;
      }
      if (filter.leaveTypeId !== undefined) {
        where.leaveTypeId = filter.leaveTypeId;
      }
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: [
        'id',
        'leaveYearId',
        'leaveTypeId',
        'allocatedBalance',
        'accruedBalance',
        'carriedForwardBalance',
        'usedBalance',
        'pendingBalance',
        'expiredBalance',
        'availableBalance',
        'createdAt',
        'updatedAt',
      ],
      defaultOrder: [
        ['leaveYearId', 'DESC'],
        ['leaveTypeId', 'ASC'],
      ],
    });

    const query: FindAndCountOptions<any> = {
      where,
      order,
      include: [
        {
          model: LeaveYear,
          as: 'leaveYear',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
        {
          model: LeaveType,
          as: 'leaveType',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
      ],
    };

    const pagination = resolvePagination(page, limit);

    if (pagination) {
      query.limit = pagination.limit;
      query.offset = pagination.offset;

      const { rows, count } = await LeaveBalance.findAndCountAll(query);
      const total = Array.isArray(count) ? count.length : count;

      return {
        data: rows,
        pagination: buildPagination(total, pagination.page, pagination.limit),
      };
    }

    const rows = await LeaveBalance.findAll(query);
    return { data: rows };
  }

  async getEmployeeBalanceForLeaveYear(
    hostId: number,
    userId: number,
    leaveYearId: number
  ): Promise<LeaveBalanceInstance[]> {
    return LeaveBalance.findAll({
      where: {
        hostId,
        userId,
        leaveYearId,
        isDeleted: 0,
      },
      include: [
        {
          model: LeaveType,
          as: 'leaveType',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
        {
          model: LeaveYear,
          as: 'leaveYear',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
      ],
      order: [['leaveTypeId', 'ASC']],
    } as any);
  }

  async getBalanceByLeaveType(params: {
    hostId: number;
    userId: number;
    leaveTypeId: number;
    leaveYearId?: number;
  }): Promise<LeaveBalanceInstance[]> {
    const { hostId, userId, leaveTypeId, leaveYearId } = params;

    const where: any = {
      hostId,
      userId,
      leaveTypeId,
      isDeleted: 0,
    };

    if (leaveYearId !== undefined) {
      where.leaveYearId = leaveYearId;
    }

    return LeaveBalance.findAll({
      where,
      include: [
        {
          model: LeaveType,
          as: 'leaveType',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
        {
          model: LeaveYear,
          as: 'leaveYear',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
      ],
      order: [['leaveYearId', 'DESC']],
    } as any);
  }

  async getBalanceRecord(params: {
    hostId: number;
    userId: number;
    leaveYearId: number;
    leaveTypeId: number;
    transaction?: Transaction;
  }): Promise<LeaveBalanceInstance | null> {
    const { hostId, userId, leaveYearId, leaveTypeId, transaction } = params;

    return LeaveBalance.findOne({
      where: {
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        isDeleted: 0,
      },
      transaction,
    } as any);
  }

  async getBalanceRecordForUpdate(params: {
    hostId: number;
    userId: number;
    leaveYearId: number;
    leaveTypeId: number;
    transaction: Transaction;
  }): Promise<LeaveBalanceInstance | null> {
    const { hostId, userId, leaveYearId, leaveTypeId, transaction } = params;

    return LeaveBalance.findOne({
      where: {
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        isDeleted: 0,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    } as any);
  }

  async lockUserForBalanceUpdate(hostId: number, userId: number, transaction: Transaction): Promise<any | null> {
    return User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
      attributes: ['id', 'hostId', 'leavePolicyId'],
    } as any);
  }

  async createZeroBalanceRecord(params: {
    hostId: number;
    userId: number;
    leaveYearId: number;
    leaveTypeId: number;
    transaction: Transaction;
  }): Promise<LeaveBalanceInstance> {
    const { hostId, userId, leaveYearId, leaveTypeId, transaction } = params;

    return this.create(
      {
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        allocatedBalance: 0,
        accruedBalance: 0,
        carriedForwardBalance: 0,
        usedBalance: 0,
        pendingBalance: 0,
        expiredBalance: 0,
        availableBalance: 0,
      } as any,
      transaction
    );
  }

  async updateBalanceRecord(params: {
    hostId: number;
    userId: number;
    leaveYearId: number;
    leaveTypeId: number;
    updates: {
      allocatedBalance: number;
      accruedBalance: number;
      carriedForwardBalance: number;
      usedBalance: number;
      pendingBalance: number;
      expiredBalance: number;
      availableBalance: number;
    };
    transaction: Transaction;
  }): Promise<LeaveBalanceInstance | null> {
    const { hostId, userId, leaveYearId, leaveTypeId, updates, transaction } = params;

    const balance = await this.getBalanceRecord({
      hostId,
      userId,
      leaveYearId,
      leaveTypeId,
      transaction,
    });

    if (!balance) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    await balance.update(
      {
        ...updates,
        updatedAt: now,
      } as any,
      { transaction }
    );

    return balance;
  }

  async getUserById(hostId: number, userId: number, transaction?: Transaction): Promise<any> {
    return User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      transaction,
    } as any);
  }
}

export default new LeaveBalanceRepository();
