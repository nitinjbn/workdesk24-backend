import { FindAndCountOptions, Op, Transaction } from 'sequelize';
import { LeaveBalanceTransaction, LeaveType, LeaveYear } from '../../../models';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

type LeaveBalanceTransactionInstance = typeof LeaveBalanceTransaction.prototype;

export class LeaveBalanceTransactionRepository {
  async createTransaction(params: {
    hostId: number;
    userId: number;
    leaveYearId: number;
    leaveTypeId: number;
    transactionType:
      | 'OPENING'
      | 'ALLOCATION'
      | 'ACCRUAL'
      | 'CARRY_FORWARD'
      | 'LEAVE_DEBIT'
      | 'LEAVE_REVERSAL'
      | 'ADJUSTMENT'
      | 'EXPIRY'
      | 'ENCASHMENT';
    quantity: number;
    openingBalance: number;
    closingBalance: number;
    reason?: string;
    createdBy?: number;
    transaction: Transaction;
  }): Promise<LeaveBalanceTransactionInstance> {
    const {
      hostId,
      userId,
      leaveYearId,
      leaveTypeId,
      transactionType,
      quantity,
      openingBalance,
      closingBalance,
      reason,
      createdBy,
      transaction,
    } = params;

    const now = Math.floor(Date.now() / 1000);

    return LeaveBalanceTransaction.create(
      {
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        transactionType,
        quantity,
        openingBalance,
        closingBalance,
        reason: reason?.trim() || null,
        createdBy: createdBy || null,
        createdAt: now,
      } as any,
      { transaction }
    );
  }

  async getTransactionHistory(params: {
    hostId: number;
    userId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: LeaveBalanceTransactionInstance[]; pagination?: any }> {
    const { hostId, userId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      userId,
    };

    if (filter) {
      if (filter.leaveYearId !== undefined) {
        where.leaveYearId = filter.leaveYearId;
      }
      if (filter.leaveTypeId !== undefined) {
        where.leaveTypeId = filter.leaveTypeId;
      }
      if (filter.transactionType) {
        where.transactionType = filter.transactionType;
      }
      if (filter.fromCreatedAt || filter.toCreatedAt) {
        where.createdAt = {};
        if (filter.fromCreatedAt) {
          where.createdAt[Op.gte] = filter.fromCreatedAt;
        }
        if (filter.toCreatedAt) {
          where.createdAt[Op.lte] = filter.toCreatedAt;
        }
      }
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: [
        'id',
        'leaveYearId',
        'leaveTypeId',
        'transactionType',
        'quantity',
        'openingBalance',
        'closingBalance',
        'createdAt',
      ],
      defaultOrder: [
        ['createdAt', 'DESC'],
        ['id', 'DESC'],
      ],
    });

    const query: FindAndCountOptions<any> = {
      where,
      order,
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
    };

    const pagination = resolvePagination(page, limit);

    if (pagination) {
      query.limit = pagination.limit;
      query.offset = pagination.offset;

      const { rows, count } = await LeaveBalanceTransaction.findAndCountAll(query);
      const total = Array.isArray(count) ? count.length : count;

      return {
        data: rows,
        pagination: buildPagination(total, pagination.page, pagination.limit),
      };
    }

    const rows = await LeaveBalanceTransaction.findAll(query);
    return { data: rows };
  }
}

export default new LeaveBalanceTransactionRepository();
