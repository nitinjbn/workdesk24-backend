import { FindAndCountOptions, Op, Transaction } from 'sequelize';
import {
  Holiday,
  LeaveRequest,
  LeaveRequestApproval,
  LeaveRequestDay,
  LeaveType,
  LeaveYear,
  User,
} from '../../../models';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

export class LeaveRequestAppRepository {
  private getTodayYmd(): string {
    return new Date().toISOString().slice(0, 10);
  }

  private async resolveLeaveYearForDate(hostId: number, date: string): Promise<any | null> {
    return LeaveYear.findOne({
      where: {
        hostId,
        isDeleted: 0,
        startDate: {
          [Op.lte]: date,
        },
        endDate: {
          [Op.gte]: date,
        },
      },
    } as any);
  }

  async getDefaultHolidayCalendarByLeaveYear(hostId: number, leaveYearId: number): Promise<any | null> {
    return (User as any).sequelize.models.HolidayCalendar.findOne({
      where: {
        hostId,
        leaveYearId,
        isDefault: 1,
        isEnabled: 1,
        isDeleted: 0,
      },
      include: [
        {
          model: LeaveYear,
          as: 'leaveYear',
          required: true,
          where: {
            hostId,
            id: leaveYearId,
            isDeleted: 0,
          },
        },
      ],
    } as any);
  }

  async resolveEffectiveHolidayCalendarForUser(payload: {
    hostId: number;
    userId: number;
    leaveYearId?: number;
  }): Promise<{ user: any | null; holidayCalendar: any | null; source: 'USER' | 'DEFAULT' | null; leaveYearId: number | null }> {
    const { hostId, userId, leaveYearId } = payload;

    const user = await this.getUserWithLeaveConfig(hostId, userId);
    if (!user) {
      return {
        user: null,
        holidayCalendar: null,
        source: null,
        leaveYearId: null,
      };
    }

    const userPlain = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    const userHolidayCalendarId = Number((userPlain as any).holidayCalendarId || 0);
    const userHolidayCalendar = (userPlain as any).holidayCalendar;

    if (userHolidayCalendarId) {
      if (
        userHolidayCalendar &&
        Number((userHolidayCalendar as any).isEnabled) === 1 &&
        Number((userHolidayCalendar as any).hostId) === Number(hostId)
      ) {
        const calendarLeaveYearId = Number((userHolidayCalendar as any).leaveYearId || 0);
        if (!leaveYearId || calendarLeaveYearId === Number(leaveYearId)) {
          return {
            user: userPlain,
            holidayCalendar: userHolidayCalendar,
            source: 'USER',
            leaveYearId: calendarLeaveYearId || null,
          };
        }
      }

      return {
        user: userPlain,
        holidayCalendar: null,
        source: null,
        leaveYearId: leaveYearId || null,
      };
    }

    let targetLeaveYearId = leaveYearId ? Number(leaveYearId) : 0;
    if (!targetLeaveYearId) {
      const leaveYear = await this.resolveLeaveYearForDate(hostId, this.getTodayYmd());
      targetLeaveYearId = leaveYear ? Number((leaveYear as any).id) : 0;
    }

    if (!targetLeaveYearId) {
      return {
        user: userPlain,
        holidayCalendar: null,
        source: null,
        leaveYearId: null,
      };
    }

    const defaultHolidayCalendar = await this.getDefaultHolidayCalendarByLeaveYear(hostId, targetLeaveYearId);

    return {
      user: userPlain,
      holidayCalendar: defaultHolidayCalendar,
      source: defaultHolidayCalendar ? 'DEFAULT' : null,
      leaveYearId: targetLeaveYearId,
    };
  }

  async getHolidaysByCalendar(payload: {
    hostId: number;
    holidayCalendarId: number;
    leaveYearId?: number;
  }): Promise<any[]> {
    const { hostId, holidayCalendarId, leaveYearId } = payload;

    const where: any = {
      hostId,
      holidayCalendarId,
      isDeleted: 0,
      isEnabled: 1,
    };

    if (leaveYearId) {
      const leaveYear = await LeaveYear.findOne({
        where: {
          hostId,
          id: leaveYearId,
          isDeleted: 0,
        },
      } as any);

      if (!leaveYear) {
        return [];
      }

      where.holidayDate = {
        [Op.gte]: (leaveYear as any).startDate,
        [Op.lte]: (leaveYear as any).endDate,
      };
    }

    return Holiday.findAll({
      where,
      order: [['holidayDate', 'ASC']],
    } as any);
  }

  async getUserWithLeaveConfig(hostId: number, userId: number): Promise<any | null> {
    return User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      include: [
        {
          model: (User as any).sequelize.models.HolidayCalendar,
          as: 'holidayCalendar',
          required: false,
          where: {
            hostId,
            isDeleted: 0,
          },
          include: [
            {
              model: LeaveYear,
              as: 'leaveYear',
              required: false,
              where: {
                hostId,
                isDeleted: 0,
              },
            },
          ],
        },
        {
          model: (User as any).sequelize.models.LeavePolicy,
          as: 'leavePolicy',
          required: false,
          where: {
            hostId,
            isDeleted: 0,
          },
        },
      ],
    } as any);
  }

  async getEnabledLeaveTypesForUser(hostId: number, userId: number): Promise<any[]> {
    const user = await this.getUserWithLeaveConfig(hostId, userId);
    if (!user || !(user as any).leavePolicyId) {
      return [];
    }

    const leavePolicyId = Number((user as any).leavePolicyId);

    const rules = await (LeaveType as any).sequelize.models.LeavePolicyRule.findAll({
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
    } as any);

    return rules;
  }

  async getHolidaysForUser(payload: {
    hostId: number;
    userId: number;
    leaveYearId?: number;
  }): Promise<any[]> {
    const { hostId, userId, leaveYearId } = payload;

    const resolved = await this.resolveEffectiveHolidayCalendarForUser({
      hostId,
      userId,
      leaveYearId,
    });

    if (!resolved.holidayCalendar) {
      return [];
    }

    const calendar =
      resolved.holidayCalendar && typeof resolved.holidayCalendar.toJSON === 'function'
        ? resolved.holidayCalendar.toJSON()
        : resolved.holidayCalendar;

    return this.getHolidaysByCalendar({
      hostId,
      holidayCalendarId: Number((calendar as any).id),
      leaveYearId: leaveYearId || undefined,
    });
  }

  async getLeaveRequests(payload: {
    hostId: number;
    userId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: any[]; pagination?: any }> {
    const { hostId, userId, filter, page, limit, sortBy, sortOrder } = payload;

    const where: any = {
      hostId,
      userId,
      isDeleted: 0,
    };

    if (filter) {
      if (filter.status) {
        where.status = filter.status;
      }
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
      allowedSortBy: ['id', 'status', 'fromDate', 'tillDate', 'submittedAt', 'createdAt', 'updatedAt'],
      defaultOrder: [['createdAt', 'DESC']],
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

      const { rows, count } = await LeaveRequest.findAndCountAll(query);
      const total = Array.isArray(count) ? count.length : count;

      return {
        data: rows,
        pagination: buildPagination(total, pagination.page, pagination.limit),
      };
    }

    const rows = await LeaveRequest.findAll(query);
    return { data: rows };
  }

  async getLeaveRequestById(hostId: number, userId: number, id: number): Promise<any | null> {
    return LeaveRequest.findOne({
      where: {
        hostId,
        userId,
        id,
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
    } as any);
  }

  async getLeaveRequestByLocalId(
    hostId: number,
    userId: number,
    requestLocalId: string,
    transaction?: Transaction,
    lockForUpdate = false
  ): Promise<any | null> {
    return LeaveRequest.findOne({
      where: {
        hostId,
        userId,
        requestLocalId,
        isDeleted: 0,
      },
      transaction,
      lock: lockForUpdate && transaction ? transaction.LOCK.UPDATE : undefined,
    } as any);
  }

  async lockUserForLeaveOps(hostId: number, userId: number, transaction: Transaction): Promise<any | null> {
    return User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
      attributes: ['id', 'hostId'],
    } as any);
  }

  async getLeaveRequestByIdForUpdate(
    hostId: number,
    userId: number,
    id: number,
    transaction: Transaction
  ): Promise<any | null> {
    return LeaveRequest.findOne({
      where: {
        hostId,
        userId,
        id,
        isDeleted: 0,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    } as any);
  }

  async findOverlappingLeaveRequests(payload: {
    hostId: number;
    userId: number;
    fromDate: string;
    tillDate: string;
    excludeLeaveRequestId?: number;
    transaction?: Transaction;
  }): Promise<any[]> {
    const { hostId, userId, fromDate, tillDate, excludeLeaveRequestId, transaction } = payload;

    const where: any = {
      hostId,
      userId,
      isDeleted: 0,
      status: {
        [Op.in]: ['DRAFT', 'PENDING', 'APPROVED'],
      },
      fromDate: {
        [Op.lte]: tillDate,
      },
      tillDate: {
        [Op.gte]: fromDate,
      },
    };

    if (excludeLeaveRequestId) {
      where.id = {
        [Op.ne]: excludeLeaveRequestId,
      };
    }

    return LeaveRequest.findAll({
      where,
      order: [['fromDate', 'ASC']],
      transaction,
    } as any);
  }

  async getLeaveRequestDays(
    hostId: number,
    userId: number,
    leaveRequestId: number,
    transaction?: Transaction
  ): Promise<any[]> {
    return LeaveRequestDay.findAll({
      where: {
        hostId,
        userId,
        leaveRequestId,
      },
      transaction,
      order: [['leaveDate', 'ASC']],
    } as any);
  }

  async getLeaveRequestApprovals(hostId: number, leaveRequestId: number): Promise<any[]> {
    return LeaveRequestApproval.findAll({
      where: {
        hostId,
        leaveRequestId,
      },
      order: [['createdAt', 'ASC']],
    } as any);
  }

  async createLeaveRequest(payload: {
    hostId: number;
    userId: number;
    leaveTypeId: number;
    leaveYearId: number;
    fromDate: string;
    tillDate: string;
    totalDays: number;
    reason?: string;
    requestLocalId?: string;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    submittedAt?: number;
    transaction: Transaction;
  }): Promise<any> {
    const now = Math.floor(Date.now() / 1000);

    return LeaveRequest.create(
      {
        hostId: payload.hostId,
        userId: payload.userId,
        leaveTypeId: payload.leaveTypeId,
        leaveYearId: payload.leaveYearId,
        fromDate: payload.fromDate,
        tillDate: payload.tillDate,
        totalDays: payload.totalDays,
        reason: payload.reason?.trim() || null,
        requestLocalId: payload.requestLocalId?.trim() || null,
        status: payload.status,
        submittedAt: payload.submittedAt || null,
        approvedAt: null,
        rejectedAt: null,
        cancelledAt: null,
        withdrawnAt: null,
        isDeleted: 0,
        deletedAt: null,
        createdAt: now,
        updatedAt: now,
      } as any,
      { transaction: payload.transaction }
    );
  }

  async createLeaveRequestDays(payload: {
    hostId: number;
    userId: number;
    leaveRequestId: number;
    days: Array<{ leaveDate: string; durationType: 'FULL_DAY' | 'FIRST_HALF' | 'SECOND_HALF'; durationDays: number }>;
    transaction: Transaction;
  }): Promise<any[]> {
    const now = Math.floor(Date.now() / 1000);

    const records = payload.days.map((day) => ({
      hostId: payload.hostId,
      userId: payload.userId,
      leaveRequestId: payload.leaveRequestId,
      leaveDate: day.leaveDate,
      durationType: day.durationType,
      durationDays: day.durationDays,
      createdAt: now,
      updatedAt: now,
    }));

    return LeaveRequestDay.bulkCreate(records as any, { transaction: payload.transaction });
  }

  async createLeaveRequestApproval(payload: {
    hostId: number;
    leaveRequestId: number;
    approverUserId?: number;
    action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    previousStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    newStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    comment?: string;
    transaction: Transaction;
  }): Promise<any> {
    const now = Math.floor(Date.now() / 1000);

    return LeaveRequestApproval.create(
      {
        hostId: payload.hostId,
        leaveRequestId: payload.leaveRequestId,
        approverUserId: payload.approverUserId || null,
        action: payload.action,
        previousStatus: payload.previousStatus || null,
        newStatus: payload.newStatus,
        comment: payload.comment?.trim() || null,
        createdAt: now,
      } as any,
      { transaction: payload.transaction }
    );
  }

  async updateLeaveRequestStatus(payload: {
    hostId: number;
    userId: number;
    leaveRequestId: number;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    submittedAt?: number | null;
    cancelledAt?: number | null;
    withdrawnAt?: number | null;
    transaction: Transaction;
  }): Promise<any | null> {
    const request = await this.getLeaveRequestByIdForUpdate(
      payload.hostId,
      payload.userId,
      payload.leaveRequestId,
      payload.transaction
    );

    if (!request) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);

    await request.update(
      {
        status: payload.status,
        submittedAt: payload.submittedAt !== undefined ? payload.submittedAt : (request as any).submittedAt,
        cancelledAt: payload.cancelledAt !== undefined ? payload.cancelledAt : (request as any).cancelledAt,
        withdrawnAt: payload.withdrawnAt !== undefined ? payload.withdrawnAt : (request as any).withdrawnAt,
        updatedAt: now,
      } as any,
      { transaction: payload.transaction }
    );

    return request;
  }

  async getLeaveSummary(hostId: number, userId: number): Promise<any> {
    const [pendingRequests, approvedRequests, availableBalances] = await Promise.all([
      LeaveRequest.count({
        where: {
          hostId,
          userId,
          status: 'PENDING',
          isDeleted: 0,
        },
      } as any),
      LeaveRequest.count({
        where: {
          hostId,
          userId,
          status: 'APPROVED',
          isDeleted: 0,
        },
      } as any),
      (LeaveRequest as any).sequelize.models.LeaveBalance.findAll({
        where: {
          hostId,
          userId,
          isDeleted: 0,
        },
        attributes: ['availableBalance'],
      }),
    ]);

    const totalAvailableBalance = (availableBalances || []).reduce((sum: number, item: any) => {
      return sum + Number(item.availableBalance || 0);
    }, 0);

    return {
      pendingRequests: Number(pendingRequests || 0),
      approvedRequests: Number(approvedRequests || 0),
      totalAvailableBalance: Number(totalAvailableBalance.toFixed(2)),
    };
  }
}

export default new LeaveRequestAppRepository();
