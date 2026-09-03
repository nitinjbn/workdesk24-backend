import { FindAndCountOptions, Op} from 'sequelize';
import db, { AttendanceLocation } from '../../../models';
import { ReportResponse } from '../types/geo-fencing.types';
import baseReportHelper from '../helpers/base-report.helper';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

export class geoFencingRepository {

  async getAttendanceLocations(params: { page?: number, limit?: number, filter?: Record<string, unknown>, hostId: number, sortBy?: string, sortOrder?: "ASC" | "DESC" }): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    let order: any = [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC']
    ];

    if(sortBy && sortOrder) {
      order = [[sortBy, sortOrder]]
    }
    const where:any = {
      hostId,
      isDeleted:0
    }
    if(filter) {

      if(filter.id || filter.attendanceLocationId) {
        where.id = filter.attendanceLocationId || filter.id;
      }
      if(filter.locationName) {
        where.locationName = {
          [Op.like]: `%${(filter.locationName as string).trim()}%`,
        }
      }
      if(filter.latitude) {
        where.latitude = filter.latitude;
      }
      if(filter.longitude) {
        where.longitude = filter.longitude;
      }
      if(filter.radiusMeters) {
        where.radiusMeters = filter.radiusMeters;
      }
      if(filter.isEnabled !== undefined) {
        where.isEnabled = filter.isEnabled;
      }
    }
    const query: FindAndCountOptions<any> = {
      attributes: ["id", "locationName", "latitude", "longitude", "radiusMeters", "isEnabled", "createdAt", "updatedAt"],
      where,
      order,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
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
        data: rows
      };
    }
  }

  async getAttendanceLocationById(params: { hostId: number, attendanceLocationId: number }): Promise<any> {
    const { hostId, attendanceLocationId } = params;

    const where:any = {
      id: attendanceLocationId,
      hostId,
      isDeleted:0
    }
   
    const query: FindAndCountOptions<any> = {
      attributes: ["id", "locationName", "latitude", "longitude", "radiusMeters", "isEnabled", "createdAt", "updatedAt"],
      where,
      logging: console.log, // Enable logging for debugging
    };

    const attendanceLocationDetails = await AttendanceLocation.findOne(query);
    return {
      data: attendanceLocationDetails?.toJSON() || {}
    };
  }

  async createAttendanceLocation(params: any): Promise<any> {
    const { hostId, latitude, longitude, radiusMeters, locationName, isEnabled } = params;
    const newLocation = await AttendanceLocation.create({
      hostId,
      latitude,
      longitude,
      radiusMeters,
      locationName,
      isEnabled,
      createdAt: DateTimeFormatUtil.getCurrentUnixTime()
    });

    return newLocation.toJSON();
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
    const { updatePayload, where } = params;
    const updateResult = await AttendanceLocation.update(updatePayload, {
      where
    });
    return updateResult;
  }
}

export default new geoFencingRepository();