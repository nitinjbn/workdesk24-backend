import { FindAndCountOptions, Op, Transaction } from 'sequelize';
import db, { AttendanceLocation, sequelize, UserAttendanceLocation } from '../../../models';
import { ReportResponse } from '../types/geo-fencing.types';
import baseReportHelper from '../helpers/base-report.helper';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

export class geoFencingRepository {
  async getAttendanceLocations(params: {
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
      if (filter.id || filter.attendanceLocationId) {
        where.id = filter.attendanceLocationId || filter.id;
      }
      if (filter.locationName) {
        where.locationName = {
          [Op.like]: `%${(filter.locationName as string).trim()}%`,
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
        'locationName',
        'latitude',
        'longitude',
        'radiusMeters',
        'isEnabled',
        'createdAt',
        'updatedAt',
      ],
      where,
      order,
      logging: console.log, // Enable logging for debugging
    };

    if (page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await AttendanceLocation.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
    } else {
      const rows = await AttendanceLocation.findAll(query);
      return {
        data: rows,
      };
    }
  }

  async getAttendanceLocationById(params: {
    hostId: number;
    attendanceLocationId: number;
    includeSiteUsers?: boolean;
  }): Promise<any> {
    const { hostId, attendanceLocationId, includeSiteUsers } = params;

    const where: any = {
      id: attendanceLocationId,
      hostId,
      isDeleted: 0,
    };

    const query: FindAndCountOptions<any> = {
      attributes: [
        'id',
        'locationName',
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
          model: UserAttendanceLocation,
          as: 'siteUsers',
          where: { isDeleted: 0 },
          required: false,
        },
      ];
    }

    const attendanceLocationDetails = await AttendanceLocation.findOne(query);
    return {
      data: attendanceLocationDetails?.toJSON() || {},
    };
  }

  async createAttendanceLocation(params: any): Promise<any> {
    const { hostId, latitude, longitude, radiusMeters, locationName, isEnabled, siteUsers } =
      params;

    const transaction = await sequelize.transaction();
    try {
      const newLocation = await AttendanceLocation.create(
        {
          hostId,
          latitude,
          longitude,
          radiusMeters,
          locationName,
          isEnabled,
          createdAt: DateTimeFormatUtil.getCurrentUnixTime(),
        },
        { transaction }
      );

      if (siteUsers && siteUsers.length > 0) {
        await this.assignSiteUsersToAttendanceLocation({
          attendanceLocationId: newLocation.id,
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

  async checkAttendanceLocationNameExists(hostId: number, locationName: string): Promise<boolean> {
    const count = await AttendanceLocation.count({
      where: {
        hostId,
        locationName: locationName.trim(),
        isDeleted: 0,
      },
    });

    return count > 0;
  }

  async updateAttendanceLocation(params: any): Promise<any> {
    const { updatePayload, where, siteUsers } = params;
    const transaction = await sequelize.transaction();

    try {
      const updateResult = await AttendanceLocation.update(updatePayload, {
        where,
        transaction,
      });

      // Assign/delete site users to the attendance location
      await this.assignSiteUsersToAttendanceLocation({
        attendanceLocationId: where.id,
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

  async assignSiteUsersToAttendanceLocation(params: {
    attendanceLocationId: number;
    siteUsers: number[];
    transaction?: Transaction;
  }): Promise<any> {
    const { attendanceLocationId, siteUsers } = params;

    const transaction: Transaction = params.transaction || (await sequelize.transaction());

    try {
      const now = Math.floor(Date.now() / 1000);

      // Remove duplicate user IDs
      const uniqueSiteUsers = [...new Set(siteUsers)];

      // Get all existing mappings, including soft-deleted ones
      const existingRecords = await UserAttendanceLocation.findAll({
        where: {
          attendanceLocationId,
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
        await UserAttendanceLocation.bulkCreate(
          newUserIds.map((userId) => ({
            userId,
            attendanceLocationId,
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
        attendanceLocationId,
        siteUsers: uniqueSiteUsers,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }
}

export default new geoFencingRepository();
