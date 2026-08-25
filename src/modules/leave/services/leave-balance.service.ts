import { Transaction } from 'sequelize';
import { LeaveType, LeaveYear, sequelize } from '../../../models';
import leaveBalanceRepository from '../repositories/leave-balance.repository';
import leaveBalanceTransactionRepository from '../repositories/leave-balance-transaction.repository';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import leavePolicyService from './leave-policy.service';

const BALANCE_TRANSACTION_TYPES = [
  'OPENING',
  'ALLOCATION',
  'ACCRUAL',
  'CARRY_FORWARD',
  'LEAVE_DEBIT',
  'LEAVE_REVERSAL',
  'ADJUSTMENT',
  'EXPIRY',
  'ENCASHMENT',
] as const;

type BalanceTransactionType = (typeof BALANCE_TRANSACTION_TYPES)[number];

export class LeaveBalanceService {
  private toNumber(value: unknown): number {
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : 0;
  }

  private normalize2(value: number): number {
    return Number(value.toFixed(2));
  }

  private calculateAvailableBalance(payload: {
    allocatedBalance: number;
    accruedBalance: number;
    carriedForwardBalance: number;
    usedBalance: number;
    pendingBalance: number;
    expiredBalance: number;
  }): number {
    const {
      allocatedBalance,
      accruedBalance,
      carriedForwardBalance,
      usedBalance,
      pendingBalance,
      expiredBalance,
    } = payload;

    return this.normalize2(
      allocatedBalance +
        accruedBalance +
        carriedForwardBalance -
        usedBalance -
        pendingBalance -
        expiredBalance
    );
  }

  private async assertUserBelongsToHost(
    hostId: number,
    userId: number,
    transaction?: Transaction
  ): Promise<any> {
    const user = await leaveBalanceRepository.getUserById(hostId, userId, transaction);
    if (!user) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404);
    }
    return user;
  }

  private async assertLeaveYearBelongsToHost(
    hostId: number,
    leaveYearId: number,
    transaction?: Transaction
  ): Promise<void> {
    const leaveYear = await LeaveYear.findOne({
      where: {
        hostId,
        id: leaveYearId,
        isDeleted: 0,
      },
      transaction,
    } as any);

    if (!leaveYear) {
      throw createConfiguredError('LEAVE_YEAR_NOT_FOUND', 'Leave year not found', 404);
    }
  }

  private async assertLeaveTypeBelongsToHost(
    hostId: number,
    leaveTypeId: number,
    transaction?: Transaction
  ): Promise<void> {
    const leaveType = await LeaveType.findOne({
      where: {
        hostId,
        id: leaveTypeId,
        isDeleted: 0,
      },
      transaction,
    } as any);

    if (!leaveType) {
      throw createConfiguredError('LEAVE_TYPE_NOT_FOUND', 'Leave type not found', 404);
    }
  }

  private async getAllowNegativeBalance(payload: {
    hostId: number;
    userId: number;
    leaveTypeId: number;
    transaction?: Transaction;
  }): Promise<boolean> {
    const { hostId, userId, leaveTypeId, transaction } = payload;

    try {
      const resolved = await leavePolicyService.resolveEmployeeLeavePolicyRule({
        hostId,
        userId,
        leaveTypeId,
        transaction,
      });

      const rule = resolved.leavePolicyRule;
      return Number((rule as any).allowNegativeBalance) === 1;
    } catch {
      return false;
    }
  }

  async applyBalanceChange(payload: {
    hostId: number;
    userId: number;
    leaveYearId: number;
    leaveTypeId: number;
    transactionType: BalanceTransactionType;
    quantity: number;
    reason?: string;
    createdBy?: number;
    deltas: {
      allocatedBalanceDelta?: number;
      accruedBalanceDelta?: number;
      carriedForwardBalanceDelta?: number;
      usedBalanceDelta?: number;
      pendingBalanceDelta?: number;
      expiredBalanceDelta?: number;
    };
    transaction?: Transaction;
  }): Promise<{ balance: any; ledgerTransaction: any }> {
    const {
      hostId,
      userId,
      leaveYearId,
      leaveTypeId,
      transactionType,
      quantity,
      reason,
      createdBy,
      deltas,
    } = payload;

    if (!BALANCE_TRANSACTION_TYPES.includes(transactionType)) {
      throw createConfiguredError('INVALID_INPUT', 'Invalid transactionType provided', 400);
    }

    if (typeof quantity !== 'number' || Number.isNaN(quantity) || quantity === 0) {
      throw createConfiguredError(
        'INVALID_BALANCE_CHANGE',
        'quantity must be a non-zero number',
        400
      );
    }

    const existingTransaction = payload.transaction;
    const transaction = existingTransaction || (await sequelize.transaction());

    try {
      await this.assertUserBelongsToHost(hostId, userId, transaction);
      await leaveBalanceRepository.lockUserForBalanceUpdate(hostId, userId, transaction);
      await this.assertLeaveYearBelongsToHost(hostId, leaveYearId, transaction);
      await this.assertLeaveTypeBelongsToHost(hostId, leaveTypeId, transaction);

      let balance = await leaveBalanceRepository.getBalanceRecordForUpdate({
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        transaction,
      });

      if (!balance) {
        try {
          balance = await leaveBalanceRepository.createZeroBalanceRecord({
            hostId,
            userId,
            leaveYearId,
            leaveTypeId,
            transaction,
          });
        } catch (createError: any) {
          const message = String(createError?.message || '').toLowerCase();
          if (!message.includes('uk_employee_leave_balance_host_user_year_type')) {
            throw createError;
          }
        }

        balance = await leaveBalanceRepository.getBalanceRecordForUpdate({
          hostId,
          userId,
          leaveYearId,
          leaveTypeId,
          transaction,
        });

        if (!balance) {
          throw createConfiguredError('LEAVE_BALANCE_NOT_FOUND', 'Leave balance not found', 404);
        }
      }

      const allocatedBalance = this.toNumber((balance as any).allocatedBalance);
      const accruedBalance = this.toNumber((balance as any).accruedBalance);
      const carriedForwardBalance = this.toNumber((balance as any).carriedForwardBalance);
      const usedBalance = this.toNumber((balance as any).usedBalance);
      const pendingBalance = this.toNumber((balance as any).pendingBalance);
      const expiredBalance = this.toNumber((balance as any).expiredBalance);
      const openingBalance = this.toNumber((balance as any).availableBalance);

      const nextAllocated = this.normalize2(
        allocatedBalance + this.toNumber(deltas.allocatedBalanceDelta)
      );
      const nextAccrued = this.normalize2(accruedBalance + this.toNumber(deltas.accruedBalanceDelta));
      const nextCarriedForward = this.normalize2(
        carriedForwardBalance + this.toNumber(deltas.carriedForwardBalanceDelta)
      );
      const nextUsed = this.normalize2(usedBalance + this.toNumber(deltas.usedBalanceDelta));
      const nextPending = this.normalize2(pendingBalance + this.toNumber(deltas.pendingBalanceDelta));
      const nextExpired = this.normalize2(expiredBalance + this.toNumber(deltas.expiredBalanceDelta));

      if (
        nextAllocated < 0 ||
        nextAccrued < 0 ||
        nextCarriedForward < 0 ||
        nextUsed < 0 ||
        nextPending < 0 ||
        nextExpired < 0
      ) {
        throw createConfiguredError(
          'INVALID_BALANCE_CHANGE',
          'Balance components cannot become negative',
          400
        );
      }

      const closingBalance = this.calculateAvailableBalance({
        allocatedBalance: nextAllocated,
        accruedBalance: nextAccrued,
        carriedForwardBalance: nextCarriedForward,
        usedBalance: nextUsed,
        pendingBalance: nextPending,
        expiredBalance: nextExpired,
      });

      const allowNegativeBalance = await this.getAllowNegativeBalance({
        hostId,
        userId,
        leaveTypeId,
        transaction,
      });

      if (closingBalance < 0 && !allowNegativeBalance) {
        throw createConfiguredError(
          'NEGATIVE_BALANCE_NOT_ALLOWED',
          'Negative leave balance is not allowed for this user and leave type',
          400
        );
      }

      const updatedBalance = await leaveBalanceRepository.updateBalanceRecord({
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        updates: {
          allocatedBalance: nextAllocated,
          accruedBalance: nextAccrued,
          carriedForwardBalance: nextCarriedForward,
          usedBalance: nextUsed,
          pendingBalance: nextPending,
          expiredBalance: nextExpired,
          availableBalance: closingBalance,
        },
        transaction,
      });

      if (!updatedBalance) {
        throw createConfiguredError('LEAVE_BALANCE_NOT_FOUND', 'Leave balance not found', 404);
      }

      const ledgerTransaction = await leaveBalanceTransactionRepository.createTransaction({
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        transactionType,
        quantity: this.normalize2(quantity),
        openingBalance,
        closingBalance,
        reason,
        createdBy,
        transaction,
      });

      if (!existingTransaction) {
        await transaction.commit();
      }

      return {
        balance: updatedBalance,
        ledgerTransaction,
      };
    } catch (error) {
      if (!existingTransaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async getEmployeeLeaveBalances(payload: {
    hostId: number;
    userId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, userId, filter, page, limit, sortBy, sortOrder } = payload;

    await this.assertUserBelongsToHost(hostId, userId);

    const report = await leaveBalanceRepository.getEmployeeLeaveBalances({
      hostId,
      userId,
      filter,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );
    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      balances: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getEmployeeBalanceForLeaveYear(payload: {
    hostId: number;
    userId: number;
    leaveYearId: number;
  }): Promise<any> {
    const { hostId, userId, leaveYearId } = payload;

    await this.assertUserBelongsToHost(hostId, userId);
    await this.assertLeaveYearBelongsToHost(hostId, leaveYearId);

    const balances = await leaveBalanceRepository.getEmployeeBalanceForLeaveYear(
      hostId,
      userId,
      leaveYearId
    );

    const plainData = balances.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      userId,
      leaveYearId,
      balances: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
    };
  }

  async getBalanceByLeaveType(payload: {
    hostId: number;
    userId: number;
    leaveTypeId: number;
    leaveYearId?: number;
  }): Promise<any> {
    const { hostId, userId, leaveTypeId, leaveYearId } = payload;

    await this.assertUserBelongsToHost(hostId, userId);
    await this.assertLeaveTypeBelongsToHost(hostId, leaveTypeId);

    if (leaveYearId !== undefined) {
      await this.assertLeaveYearBelongsToHost(hostId, leaveYearId);
    }

    const balances = await leaveBalanceRepository.getBalanceByLeaveType({
      hostId,
      userId,
      leaveTypeId,
      leaveYearId,
    });

    const plainData = balances.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      userId,
      leaveTypeId,
      leaveYearId: leaveYearId || null,
      balances: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
    };
  }

  async getBalanceTransactionHistory(payload: {
    hostId: number;
    userId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, userId, filter, page, limit, sortBy, sortOrder } = payload;

    await this.assertUserBelongsToHost(hostId, userId);

    if (filter?.leaveYearId !== undefined) {
      await this.assertLeaveYearBelongsToHost(hostId, Number(filter.leaveYearId));
    }
    if (filter?.leaveTypeId !== undefined) {
      await this.assertLeaveTypeBelongsToHost(hostId, Number(filter.leaveTypeId));
    }

    const report = await leaveBalanceTransactionRepository.getTransactionHistory({
      hostId,
      userId,
      filter,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      transactions: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async manualBalanceAdjustment(payload: {
    hostId: number;
    userId: number;
    leaveYearId: number;
    leaveTypeId: number;
    quantity: number;
    reason?: string;
    createdBy?: number;
  }): Promise<any> {
    const { hostId, userId, leaveYearId, leaveTypeId, quantity, reason, createdBy } = payload;

    if (typeof quantity !== 'number' || Number.isNaN(quantity) || quantity === 0) {
      throw createConfiguredError(
        'INVALID_BALANCE_CHANGE',
        'quantity must be a non-zero number',
        400
      );
    }

    const result = await this.applyBalanceChange({
      hostId,
      userId,
      leaveYearId,
      leaveTypeId,
      transactionType: 'ADJUSTMENT',
      quantity,
      reason,
      createdBy,
      deltas: {
        accruedBalanceDelta: quantity,
      },
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const balancePlain =
      result.balance && typeof result.balance.toJSON === 'function'
        ? result.balance.toJSON()
        : result.balance;
    const ledgerPlain =
      result.ledgerTransaction && typeof result.ledgerTransaction.toJSON === 'function'
        ? result.ledgerTransaction.toJSON()
        : result.ledgerTransaction;

    return {
      balance: formatDateTimeFieldsBySettings(balancePlain, dateTimeSettings),
      transaction: formatDateTimeFieldsBySettings(ledgerPlain, dateTimeSettings),
    };
  }
}

export default new LeaveBalanceService();
