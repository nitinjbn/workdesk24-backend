import { BaseRepository } from '../../../shared/repositories/base.repository';
import { Holiday, HolidayCalendar, LeaveYear } from '../../../models';
import { FindAndCountOptions, Op, WhereOptions, Transaction } from 'sequelize';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

type HolidayInstance = typeof Holiday.prototype;
type HolidayCalendarInstance = typeof HolidayCalendar.prototype;

export class HolidayRepository extends BaseRepository<HolidayInstance> {
  constructor() {
    super(Holiday as any);
  }

  async getHolidaysByCalendar(params: {
    hostId: number;
    holidayCalendarId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: HolidayInstance[]; pagination?: any }> {
    const { hostId, holidayCalendarId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      holidayCalendarId,
      isDeleted: 0,
    };

    // Apply filters
    if (filter) {
      if (filter.name) {
        where.name = {
          [Op.like]: `%${(filter.name as string).trim()}%`,
        };
      }
      if (filter.isOptional !== undefined) {
        where.isOptional = filter.isOptional;
      }
      if (filter.isEnabled !== undefined) {
        where.isEnabled = filter.isEnabled;
      }
      if (filter.holidayDate) {
        where.holidayDate = filter.holidayDate;
      }
      if (filter.dateRange && typeof filter.dateRange === 'object') {
        const range = filter.dateRange as any;
        if (range.from && range.to) {
          where.holidayDate = {
            [Op.between]: [range.from, range.to],
          };
        }
      }
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: ['id', 'holidayDate', 'name', 'isOptional', 'isEnabled', 'createdAt', 'updatedAt'],
      defaultOrder: [['holidayDate', 'ASC']],
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

      const { rows, count } = await Holiday.findAndCountAll(query);

      return {
        data: rows,
        pagination: buildPagination(count, pagination.page, pagination.limit),
      };
    } else {
      const rows = await Holiday.findAll(query);
      return { data: rows };
    }
  }

  async getHolidayById(
    hostId: number,
    holidayId: number,
    transaction?: Transaction
  ): Promise<HolidayInstance | null> {
    return this.findOne(
      { hostId, id: holidayId } as WhereOptions<HolidayInstance>,
      transaction
    );
  }

  async checkHolidayDateExists(
    hostId: number,
    holidayCalendarId: number,
    holidayDate: string,
    excludeId?: number
  ): Promise<boolean> {
    const where: any = {
      hostId,
      holidayCalendarId,
      holidayDate,
      isDeleted: 0,
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    const count = await Holiday.count({ where } as any);
    const total = Array.isArray(count) ? count.length : Number(count || 0);
    return total > 0;
  }

  async createHoliday(
    hostId: number,
    data: {
      holidayCalendarId: number;
      holidayDate: string;
      name: string;
      description?: string;
      isOptional?: number;
      isEnabled?: number;
    },
    transaction?: Transaction
  ): Promise<HolidayInstance> {
    const now = Math.floor(Date.now() / 1000);

    return Holiday.create(
      {
        hostId,
        holidayCalendarId: data.holidayCalendarId,
        holidayDate: data.holidayDate,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        isOptional: data.isOptional || 0,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : 1,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      } as any,
      { transaction }
    );
  }

  async createBulkHolidays(
    hostId: number,
    holidays: Array<{
      holidayCalendarId: number;
      holidayDate: string;
      name: string;
      description?: string;
      isOptional?: number;
      isEnabled?: number;
    }>,
    transaction: Transaction
  ): Promise<HolidayInstance[]> {
    const now = Math.floor(Date.now() / 1000);

    const holidaysToCreate = holidays.map((h) => ({
      hostId,
      holidayCalendarId: h.holidayCalendarId,
      holidayDate: h.holidayDate,
      name: h.name.trim(),
      description: h.description?.trim() || null,
      isOptional: h.isOptional || 0,
      isEnabled: h.isEnabled !== undefined ? h.isEnabled : 1,
      isDeleted: 0,
      createdAt: now,
      updatedAt: now,
    }));

    return Holiday.bulkCreate(holidaysToCreate as any, { transaction });
  }

  async updateHoliday(
    hostId: number,
    holidayId: number,
    data: Partial<{
      holidayDate: string;
      name: string;
      description: string;
      isOptional: number;
      isEnabled: number;
    }>,
    transaction?: Transaction
  ): Promise<HolidayInstance | null> {
    const holiday = await this.getHolidayById(hostId, holidayId, transaction);
    if (!holiday) return null;

    const now = Math.floor(Date.now() / 1000);
    const updateData: any = { updatedAt: now };

    if (data.holidayDate !== undefined) {
      updateData.holidayDate = data.holidayDate;
    }
    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.isOptional !== undefined) {
      updateData.isOptional = data.isOptional;
    }
    if (data.isEnabled !== undefined) {
      updateData.isEnabled = data.isEnabled;
    }

    await holiday.update(updateData, { transaction });
    return holiday;
  }

  async enableDisableHoliday(
    hostId: number,
    holidayId: number,
    isEnabled: number,
    transaction?: Transaction
  ): Promise<HolidayInstance | null> {
    const holiday = await this.getHolidayById(hostId, holidayId, transaction);
    if (!holiday) return null;

    const now = Math.floor(Date.now() / 1000);
    await holiday.update(
      {
        isEnabled,
        updatedAt: now,
      } as any,
      { transaction }
    );

    return holiday;
  }

  async deleteHoliday(
    hostId: number,
    holidayId: number,
    transaction?: Transaction
  ): Promise<boolean> {
    const holiday = await this.getHolidayById(hostId, holidayId, transaction);
    if (!holiday) return false;

    const now = Math.floor(Date.now() / 1000);
    await holiday.update(
      {
        isDeleted: 1,
        deletedAt: now,
      } as any,
      { transaction }
    );

    return true;
  }

  async validateCalendarOwnership(
    hostId: number,
    holidayCalendarId: number
  ): Promise<HolidayCalendarInstance | null> {
    return HolidayCalendar.findOne({
      where: {
        hostId,
        id: holidayCalendarId,
        isDeleted: 0,
      },
      raw: true,
    } as any);
  }

  async getLeaveYearForCalendar(
    holidayCalendarId: number
  ): Promise<any> {
    const calendar = await HolidayCalendar.findOne({
      where: { id: holidayCalendarId, isDeleted: 0 },
      raw: true,
    } as any);

    if (!calendar) return null;

    return LeaveYear.findOne({
      where: { id: (calendar as any).leaveYearId, isDeleted: 0 },
      raw: true,
    } as any);
  }
}

export default new HolidayRepository();
