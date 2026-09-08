import { FindAndCountOptions, Op, Transaction } from 'sequelize';
import db, { AttendanceSite, sequelize, UserAttendanceSite } from '../../../models';
import { ReportResponse } from '../types/geo-fencing.types';
import baseReportHelper from '../helpers/base-report.helper';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

export class geoFencingRepository {
  async getAttendanceSites(params: {
    page?: number;
    limit?: number;
    filter?: Record<string, unknown>;
    hostId: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    let order: any = [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC'],
    ];

    if (sortBy && sortOrder) {
      order = [[sortBy, sortOrder]];
    }
    const where: any = {
      hostId,
      isDeleted: 0,
    };
    if (filter) {
      if (filter.id || filter.attendanceSiteId) {
        where.id = filter.attendanceSiteId || filter.id;
      }
      if (filter.siteName) {
        where.siteName = {
          [Op.like]: `%${(filter.siteName as string).trim()}%`,
        };
      }
      if (filter.latitude) {
        where.latitude = filter.latitude;
      }
      if (filter.longitude) {
        where.longitude = filter.longitude;
      }
      if (filter.radiusMeters) {
        where.radiusMeters = filter.radiusMeters;
      }
      if (filter.isEnabled !== undefined) {
        where.isEnabled = filter.isEnabled;
      }
    }
    const query: FindAndCountOptions<any> = {
      attributes: [
        'id',
        'siteName',
        'latitude',
        'longitude',
        'radiusMeters',
        'isEnabled',
        'createdAt',
        'updatedAt',
      ],
      where,
      include: [
        {
          attributes: [
            'userId',
            'createdAt',
            'updatedAt',
            [db.Sequelize.literal('`siteUsers->user`.`name`'), 'name'],
          ],
          model: UserAttendanceSite,
          as: 'siteUsers',
          where: { isDeleted: 0 },
          required: false,
          include: [
            {
              attributes: [],
              model: db.User,
              as: 'user',
              where: { isDeleted: 0 },
              required: false,
            },
          ],
        },
      ],
      order,
      logging: console.log, // Enable logging for debugging
    };

    if (page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await AttendanceSite.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
    } else {
      const rows = await AttendanceSite.findAll(query);
      return {
        data: rows,
      };
    }
  }

  async getAttendanceSiteById(params: {
    hostId: number;
    attendanceSiteId: number;
    includeSiteUsers?: boolean;
  }): Promise<any> {
    const { hostId, attendanceSiteId, includeSiteUsers } = params;

    const where: any = {
      id: attendanceSiteId,
      hostId,
      isDeleted: 0,
    };

    const query: FindAndCountOptions<any> = {
      attributes: [
        'id',
        'siteName',
        'latitude',
        'longitude',
        'radiusMeters',
        'isEnabled',
        'createdAt',
        'updatedAt',
      ],
      where,
      logging: console.log, // Enable logging for debugging
    };

    if (includeSiteUsers) {
      query.include = [
        {
          attributes: ['userId', 'createdAt', 'updatedAt'],
          model: UserAttendanceSite,
          as: 'siteUsers',
          where: { isDeleted: 0 },
          required: false,
        },
      ];
    }

    const attendanceSiteDetails = await AttendanceSite.findOne(query);
    return {
      data: attendanceSiteDetails?.toJSON() || {},
    };
  }

  async createAttendanceSite(params: any): Promise<any> {
    const { hostId, latitude, longitude, radiusMeters, siteName, isEnabled, siteUsers } = params;

    const transaction = await sequelize.transaction();
    try {
      const newLocation = await AttendanceSite.create(
        {
          hostId,
          latitude,
          longitude,
          radiusMeters,
          siteName,
          isEnabled,
          createdAt: DateTimeFormatUtil.getCurrentUnixTime(),
        },
        { transaction }
      );

      if (siteUsers && siteUsers.length > 0) {
        await this.assignSiteUsersToAttendanceSite({
          attendanceSiteId: newLocation.id,
          siteUsers,
          transaction,
        });
      }

      await transaction.commit();

      return newLocation.toJSON();
    } catch (error) {
      console.error('Error creating attendance location:', error);
      if (transaction) {
        await transaction.rollback();
      }
      throw error;
    }
  }

  async checkAttendanceSiteNameExists(hostId: number, siteName: string): Promise<boolean> {
    const count = await AttendanceSite.count({
      where: {
        hostId,
        siteName: siteName.trim(),
        isDeleted: 0,
      },
    });

    return count > 0;
  }

  async updateAttendanceSite(params: any): Promise<any> {
    const { updatePayload, where, siteUsers } = params;
    const transaction = await sequelize.transaction();

    try {
      const updateResult = await AttendanceSite.update(updatePayload, {
        where,
        transaction,
      });

      // Assign/delete site users to the attendance location
      await this.assignSiteUsersToAttendanceSite({
        attendanceSiteId: where.id,
        siteUsers,
        transaction,
      });

      // Commit the transaction after successfully updating the attendance location and site users
      await transaction.commit();

      return updateResult;
    } catch (error) {
      console.error('Error updating attendance location:', error);
      // Rollback the transaction in case of any error
      await transaction.rollback();
      throw error;
    }
  }

  async assignSiteUsersToAttendanceSite(params: {
    attendanceSiteId: number;
    siteUsers: number[];
    transaction?: Transaction;
  }): Promise<any> {
    const { attendanceSiteId, siteUsers } = params;

    const transaction: Transaction = params.transaction || (await sequelize.transaction());

    try {
      const now = Math.floor(Date.now() / 1000);

      // Remove duplicate user IDs
      const uniqueSiteUsers = [...new Set(siteUsers)];

      // Get all existing mappings, including soft-deleted ones
      const existingRecords = await UserAttendanceSite.findAll({
        where: {
          attendanceSiteId,
          isDeleted: 0,
        },
        transaction,
      });

      const existingUserIds = new Set(existingRecords.map((record) => Number(record.userId)));

      const requestedUserIds = new Set(uniqueSiteUsers.map((userId) => Number(userId)));

      // 1. Enable users which are present in siteUsers
      //    This also restores previously soft-deleted records.
      const usersToEnable = existingRecords.filter((record) =>
        requestedUserIds.has(Number(record.userId))
      );

      for (const record of usersToEnable) {
        await record.update(
          {
            isEnabled: 1,
            updatedAt: now,
          },
          { transaction }
        );
      }

      // 2. Disable + soft delete users which are no longer present
      const usersToDelete = existingRecords.filter(
        (record) => !requestedUserIds.has(Number(record.userId))
      );

      for (const record of usersToDelete) {
        await record.update(
          {
            isEnabled: 0,
            isDeleted: 1,
            deletedAt: now,
            updatedAt: now,
          },
          { transaction }
        );
      }

      // 3. Create mappings for completely new users
      const newUserIds = uniqueSiteUsers.filter((userId) => !existingUserIds.has(Number(userId)));

      if (newUserIds.length > 0) {
        await UserAttendanceSite.bulkCreate(
          newUserIds.map((userId) => ({
            userId,
            attendanceSiteId,
            isEnabled: 1,
            isDeleted: 0,
            deletedAt: null,
            createdAt: now,
          })),
          { transaction }
        );
      }

      //await transaction.commit();
      return {
        attendanceSiteId,
        siteUsers: uniqueSiteUsers,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export default new geoFencingRepository();
