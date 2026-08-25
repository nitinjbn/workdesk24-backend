import { BaseRepository } from '../../../shared/repositories/base.repository';
import { LeaveYear, HolidayCalendar, LeaveBalance, LeaveRequest } from '../../../models';
import { FindAndCountOptions, Op, WhereOptions, Transaction } from 'sequelize';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

type LeaveYearInstance = typeof LeaveYear.prototype;

export class LeaveYearRepository extends BaseRepository<LeaveYearInstance> {
  constructor() {
    super(LeaveYear as any);
  }

  async getLeaveYears(params: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: LeaveYearInstance[]; pagination?: any }> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      isDeleted: 0,
    };

    // Apply filters
    if (filter) {
      if (filter.year) {
        where.year = filter.year;
      }
      if (filter.startDate) {
        where.startDate = filter.startDate;
      }
      if (filter.endDate) {
        where.endDate = filter.endDate;
      }
      if (filter.search) {
        where.year = {
          [Op.like]: `%${(filter.search as string).trim()}%`,
        };
      }
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: ['id', 'year', 'startDate', 'endDate', 'createdAt', 'updatedAt'],
      defaultOrder: [['year', 'DESC']],
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

      const { rows, count } = await LeaveYear.findAndCountAll(query);

      return {
        data: rows,
        pagination: buildPagination(count, pagination.page, pagination.limit),
      };
    } else {
      const rows = await LeaveYear.findAll(query);
      return { data: rows };
    }
  }

  async getLeaveYearById(
    hostId: number,
    leaveYearId: number,
    transaction?: Transaction
  ): Promise<LeaveYearInstance | null> {
    return this.findOne(
      { hostId, id: leaveYearId } as WhereOptions<LeaveYearInstance>,
      transaction
    );
  }

  async getLeaveYearByYear(
    hostId: number,
    year: number,
    excludeId?: number
  ): Promise<LeaveYearInstance | null> {
    const where: any = {
      hostId,
      year,
      isDeleted: 0,
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    return LeaveYear.findOne({ where, raw: true });
  }

  async createLeaveYear(
    hostId: number,
    data: {
      year: number;
      startDate: string;
      endDate: string;
    },
    transaction?: Transaction
  ): Promise<LeaveYearInstance> {
    const now = Math.floor(Date.now() / 1000);

    return LeaveYear.create(
      {
        hostId,
        year: data.year,
        startDate: data.startDate,
        endDate: data.endDate,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      } as any,
      { transaction }
    );
  }

  async updateLeaveYear(
    hostId: number,
    leaveYearId: number,
    data: Partial<{
      year: number;
      startDate: string;
      endDate: string;
    }>,
    transaction?: Transaction
  ): Promise<LeaveYearInstance | null> {
    const leaveYear = await this.getLeaveYearById(hostId, leaveYearId, transaction);
    if (!leaveYear) return null;

    const now = Math.floor(Date.now() / 1000);
    await leaveYear.update(
      {
        ...data,
        updatedAt: now,
      } as any,
      { transaction }
    );

    return leaveYear;
  }

  async deleteLeaveYear(
    hostId: number,
    leaveYearId: number,
    transaction?: Transaction
  ): Promise<boolean> {
    const leaveYear = await this.getLeaveYearById(hostId, leaveYearId, transaction);
    if (!leaveYear) return false;

    const now = Math.floor(Date.now() / 1000);
    await leaveYear.update(
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
    leaveYearId: number
  ): Promise<{ hasDependents: boolean; dependencyCount: number }> {
    // Check for holiday calendars
    const holidayCalendarCount = await HolidayCalendar.count({
      where: {
        hostId,
        leaveYearId,
        isDeleted: 0,
      },
    } as any);

    // Check for leave balances
    const leaveBalanceCount = await LeaveBalance.count({
      where: {
        hostId,
        leaveYearId,
        isDeleted: 0,
      },
    } as any);

    // Check for leave requests
    const leaveRequestCount = await LeaveRequest.count({
      where: {
        hostId,
        leaveYearId,
        isDeleted: 0,
      },
    } as any);

    const totalDependents =
      (typeof holidayCalendarCount === 'number' ? holidayCalendarCount : 0) +
      (typeof leaveBalanceCount === 'number' ? leaveBalanceCount : 0) +
      (typeof leaveRequestCount === 'number' ? leaveRequestCount : 0);

    return {
      hasDependents: totalDependents > 0,
      dependencyCount: totalDependents,
    };
  }
}

export default new LeaveYearRepository();
