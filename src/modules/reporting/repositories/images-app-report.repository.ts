import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Image } from '../../../models';
import { CommonReportSortBy, ReportResponse, ReportSortDirection, GetImagesReportPayload } from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildDynamicModelFilters, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';


export class ImagesReportRepository {
  async getImagesReport(params: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number; customerId?: number } }): Promise<ReportResponse<any>> {
    const { filter, hostId, userId } = params;
    // const { offset } = baseReportHelper.normalizePagination({ page, limit });

    let where: Record<string, any> = { hostId, userId, isDeleted: 0 };
    let visitWhere: Record<string, any> = { isDeleted: 0 };
    if(filter) {
      if(filter.customerId) {
        visitWhere.customerId = filter.customerId;
      }
      if(filter.fromDate && filter.tillDate) {
        where.capturedAt = {
          [Op.gte]: filter.fromDate,
          [Op.lte]: filter.tillDate,
        };
      }
    }
    
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'localId', 'isDeleted', 'deletedAt', 'updatedAt', 'syncedAt', 'locationAccuracy', 'batteryPercentage', 'isCharging', 'locationAltitude', 'locationSpeed', 'locationProvider', 'locationProvider'],
        include: [
          ['id', 'imageId'],
          [db.Sequelize.col('user.name'), 'employeeName'],
          [db.Sequelize.col('user.employeeCode'), 'employeeCode']
        ]
      },
      where,
      include: [
        {
          model: db.User,
          as: 'user',
          attributes: [],
          required: true,
          where: {
            isDeleted: 0,
          },
        },
        {
          model: db.Visit,
          as: 'visit',
          attributes: {
            exclude: ['id', 'localId', 'isDeleted', 'deletedAt', 'updatedAt', 'syncedAt', 'checkInLocationAccuracy', 'checkOutLocationAccuracy', 'checkInBatteryPercentage', 'checkOutBatteryPercentage', 'isChargingOnCheckIn', 'isChargingOnCheckOut', 'checkInLocationAltitude', 'checkOutLocationAltitude', 'checkInLocationSpeed', 'checkOutLocationSpeed', 'checkInLocationProvider', 'checkOutLocationProvider'],
          },
          required: true,
          where: visitWhere,
        }
      ],
      order: [["capturedAt", "DESC"]],
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    const rows = await Image.findAll(query);
    return {
      data: rows
    };
  }
}

export default new ImagesReportRepository();
