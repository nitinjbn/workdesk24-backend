import { BaseRepository } from '../../../shared/repositories/base.repository';
import { HolidayCalendar, LeaveYear } from '../../../models';
import { FindAndCountOptions, Op, WhereOptions, Transaction } from 'sequelize';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

type HolidayCalendarInstance = typeof HolidayCalendar.prototype;

export class HolidayCalendarRepository extends BaseRepository<HolidayCalendarInstance> {
  constructor() {
    super(HolidayCalendar as any);
  }

  async getHolidayCalendars(params: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: HolidayCalendarInstance[]; pagination?: any }> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      isDeleted: 0,
    };

    // Apply filters
    if (filter) {
      if (filter.leaveYearId) {
        where.leaveYearId = filter.leaveYearId;
      }
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
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: ['id', 'leaveYearId', 'name', 'isDefault', 'isEnabled', 'createdAt', 'updatedAt'],
      defaultOrder: [['createdAt', 'DESC']],
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

      const { rows, count } = await HolidayCalendar.findAndCountAll(query);

      return {
        data: rows,
        pagination: buildPagination(count, pagination.page, pagination.limit),
      };
    } else {
      const rows = await HolidayCalendar.findAll(query);
      return { data: rows };
    }
  }

  async getHolidayCalendarById(
    hostId: number,
    holidayCalendarId: number,
    transaction?: Transaction
  ): Promise<HolidayCalendarInstance | null> {
    return this.findOne(
      { hostId, id: holidayCalendarId } as WhereOptions<HolidayCalendarInstance>,
      transaction
    );
  }

  async checkCalendarNameExists(
    hostId: number,
    name: string,
    excludeId?: number
  ): Promise<boolean> {
    const where: any = {
      hostId,
      name: name.trim(),
      isDeleted: 0,
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    const count = (await HolidayCalendar.count({ where } as any)) as unknown as number;
    return count > 0;
  }

  async checkDefaultCalendarExists(
    hostId: number,
    excludeId?: number
  ): Promise<HolidayCalendarInstance | null> {
    const where: any = {
      hostId,
      isDefault: 1,
      isDeleted: 0,
    };

    if (excludeId) {
      where.id = { [Op.ne]: excludeId };
    }

    return HolidayCalendar.findOne({ where } as any);
  }

  async createHolidayCalendar(
    hostId: number,
    data: {
      leaveYearId: number;
      name: string;
      description?: string;
      isDefault?: number;
      isEnabled?: number;
    },
    transaction?: Transaction
  ): Promise<HolidayCalendarInstance> {
    const now = Math.floor(Date.now() / 1000);

    return HolidayCalendar.create(
      {
        hostId,
        leaveYearId: data.leaveYearId,
        name: data.name.trim(),
        description: data.description?.trim() || null,
        isDefault: data.isDefault || 0,
        isEnabled: data.isEnabled !== undefined ? data.isEnabled : 1,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      } as any,
      { transaction }
    );
  }

  async updateHolidayCalendar(
    hostId: number,
    holidayCalendarId: number,
    data: Partial<{
      name: string;
      description: string;
      isEnabled: number;
    }>,
    transaction?: Transaction
  ): Promise<HolidayCalendarInstance | null> {
    const holidayCalendar = await this.getHolidayCalendarById(
      hostId,
      holidayCalendarId,
      transaction
    );
    if (!holidayCalendar) return null;

    const now = Math.floor(Date.now() / 1000);
    const updateData: any = { updatedAt: now };

    if (data.name !== undefined) {
      updateData.name = data.name.trim();
    }
    if (data.description !== undefined) {
      updateData.description = data.description?.trim() || null;
    }
    if (data.isEnabled !== undefined) {
      updateData.isEnabled = data.isEnabled;
    }

    await holidayCalendar.update(updateData, { transaction });
    return holidayCalendar;
  }

  async enableDisableHolidayCalendar(
    hostId: number,
    holidayCalendarId: number,
    isEnabled: number,
    transaction?: Transaction
  ): Promise<HolidayCalendarInstance | null> {
    const holidayCalendar = await this.getHolidayCalendarById(
      hostId,
      holidayCalendarId,
      transaction
    );
    if (!holidayCalendar) return null;

    const now = Math.floor(Date.now() / 1000);
    await holidayCalendar.update(
      {
        isEnabled,
        updatedAt: now,
      } as any,
      { transaction }
    );

    return holidayCalendar;
  }

  async setHolidayCalendarAsDefault(
    hostId: number,
    holidayCalendarId: number,
    transaction?: Transaction
  ): Promise<HolidayCalendarInstance | null> {
    // Unset previous default
    const previousDefault = await this.checkDefaultCalendarExists(
      hostId,
      holidayCalendarId
    );

    if (previousDefault) {
      const now = Math.floor(Date.now() / 1000);
      await previousDefault.update(
        { isDefault: 0, updatedAt: now } as any,
        { transaction }
      );
    }

    // Set new default
    const holidayCalendar = await this.getHolidayCalendarById(
      hostId,
      holidayCalendarId,
      transaction
    );
    if (!holidayCalendar) return null;

    const now = Math.floor(Date.now() / 1000);
    await holidayCalendar.update(
      { isDefault: 1, updatedAt: now } as any,
      { transaction }
    );

    return holidayCalendar;
  }

  async deleteHolidayCalendar(
    hostId: number,
    holidayCalendarId: number,
    transaction?: Transaction
  ): Promise<boolean> {
    const holidayCalendar = await this.getHolidayCalendarById(
      hostId,
      holidayCalendarId,
      transaction
    );
    if (!holidayCalendar) return false;

    const now = Math.floor(Date.now() / 1000);
    await holidayCalendar.update(
      {
        isDeleted: 1,
        deletedAt: now,
      } as any,
      { transaction }
    );

    return true;
  }
}

export default new HolidayCalendarRepository();
