import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { GpsHistory } from '../../../models';
import {
  AdminGpsHistoryJourneyPoint,
  AdminGpsHistoryJourneyResponse,
  AdminGpsHistoryJourney,
  AdminGpsHistoryJourneyEvent,
  AdminGpsHistoryResponse,
  CommonReportSortBy,
  GpsHistoryReportFilter,
  ReportResponse,
  ReportSortDirection,
} from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder, buildUserInclude, buildUserScopedWhere, extractUserFilter } from './user-scoped-report.helper';

type GpsHistoryInstance = typeof GpsHistory.prototype;

export interface GpsHistoryReportQuery {
  hostId: number;
  page: number;
  limit: number;
  filter: GpsHistoryReportFilter;
  userId?: number;
  enforceActiveUsersOnly: boolean;
  sortBy: CommonReportSortBy;
  sortOrder: ReportSortDirection;
}

export interface AdminGpsHistoryReportQuery {
  hostId: number;
  userId: number;
  fromDate: number;
  tillDate: number;
}

export interface AdminGpsHistoryJourneyReportQuery {
  hostId: number;
  userId: number;
  startTime: number;
  endTime: number;
}

interface RawAttendance {
  id: number;
  attendanceTime: number;
  dayoverTime?: number;
  attendanceLatitude?: number | string;
  attendanceLongitude?: number | string;
  attendanceAddress?: string;
  dayoverLatitude?: number | string;
  dayoverLongitude?: number | string;
  dayoverAddress?: string;
  workingHours?: number;
}

interface RawVisit {
  id: number;
  customerName?: string;
  checkInTime: number;
  checkOutTime?: number;
  checkInLatitude?: number | string;
  checkInLongitude?: number | string;
  checkInAddress?: string;
  checkOutLatitude?: number | string;
  checkOutLongitude?: number | string;
  checkOutAddress?: string;
}

export class GpsHistoryReportRepository {
  async getReport(params: GpsHistoryReportQuery): Promise<ReportResponse<GpsHistoryInstance>> {
    const { page, limit, filter, hostId, userId, enforceActiveUsersOnly, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    const where = buildUserScopedWhere<GpsHistoryInstance>(filter, userId);
    const userFilter = extractUserFilter(filter as Record<string, unknown>);
    const userInclude = buildUserInclude(hostId, userId, enforceActiveUsersOnly, userFilter);
    const order = buildCommonReportOrder(sortBy, sortOrder, {
      createdAt: 'createdAt',
      batteryPercentage: 'batteryPercentage',
      speed: 'speed',
    });

    const query: FindAndCountOptions<GpsHistoryInstance> = {
      attributes: {
        exclude: ['localId', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('user.name'), 'employeeName'],
          [db.Sequelize.col('user.employeeCode'), 'employeeCode']
        ]
      },
      where,
      include: [userInclude as Includeable],
      limit,
      offset,
      order,
      distinct: true,
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await GpsHistory.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
      
    } else {
      const rows = await GpsHistory.findAll(query);
      return {
        data: rows,
      };
    }    
  }

  async getAdminGpsHistoryReport(params: AdminGpsHistoryReportQuery): Promise<AdminGpsHistoryResponse> {
    const { hostId, userId, fromDate, tillDate } = params;

    const [user, attendance, visits, dailySummary] = await Promise.all([
      db.User.findOne({
        attributes: ['id', 'employeeCode', 'name', 'mobile', 'profileImageUrl'],
        where: {
          id: userId,
          hostId,
          isDeleted: 0,
        },
        include: [
          {
            model: db.Designation,
            as: 'designations',
            attributes: ['name'],
            where: {
              isDeleted: 0,
            },
            required: false,
          },
        ],
      }),
      db.Attendance.findOne({
        attributes: [
          'id',
          'attendanceTime',
          'dayoverTime',
          'attendanceLatitude',
          'attendanceLongitude',
          'attendanceAddress',
          'dayoverLatitude',
          'dayoverLongitude',
          'dayoverAddress',
          'workingHours',
        ],
        where: {
          hostId,
          userId,
          isDeleted: 0,
          attendanceTime: {
            [Op.between]: [fromDate, tillDate],
          },
        },
        order: [['attendanceTime', 'ASC']],
      }),
      db.Visit.findAll({
        attributes: [
          'id',
          'customerName',
          'checkInTime',
          'checkOutTime',
          'checkInLatitude',
          'checkInLongitude',
          'checkInAddress',
          'checkOutLatitude',
          'checkOutLongitude',
          'checkOutAddress',
        ],
        where: {
          hostId,
          userId,
          isDeleted: 0,
          checkInTime: {
            [Op.between]: [fromDate, tillDate],
          },
        },
        order: [['checkInTime', 'ASC']],
      }),
      db.UserDailySummary.findOne({
        attributes: ['totalOrders', 'totalPayments', 'totalFeedbacks', 'totalImages'],
        where: {
          hostId,
          userId,
          isDeleted: 0,
          reportDate: {
            [Op.between]: [fromDate, tillDate],
          },
        },
        order: [['reportDate', 'DESC']],
      }),
    ]);

    const userJson = user?.toJSON() as Record<string, any> | undefined;
    const designationName = userJson?.designations?.name || '';

    const attendanceJson = attendance?.toJSON() as RawAttendance | undefined;
    const visitsJson = visits.map((visit) => visit.toJSON() as RawVisit);
    const dailySummaryJson = dailySummary?.toJSON() as Record<string, unknown> | undefined;

    const orderCount = this.toNonNegativeInteger(dailySummaryJson?.totalOrders);
    const paymentCount = this.toNonNegativeInteger(dailySummaryJson?.totalPayments);
    const feedbackCount = this.toNonNegativeInteger(dailySummaryJson?.totalFeedbacks);
    const imageCount = this.toNonNegativeInteger(dailySummaryJson?.totalImages);

    const attendanceEvent = this.toJourneyEvent('ATTENDANCE', {
      id: attendanceJson?.id,
      time: attendanceJson?.attendanceTime,
      latitude: attendanceJson?.attendanceLatitude,
      longitude: attendanceJson?.attendanceLongitude,
      address: attendanceJson?.attendanceAddress,
    });

    const dayoverEvent = this.toJourneyEvent('DAYOVER', {
      id: attendanceJson?.id,
      time: attendanceJson?.dayoverTime,
      latitude: attendanceJson?.dayoverLatitude,
      longitude: attendanceJson?.dayoverLongitude,
      address: attendanceJson?.dayoverAddress,
    });

    const visitEvents = visitsJson.map((visit) => ({
      checkIn: this.toJourneyEvent('VISIT', {
        id: visit.id,
        time: visit.checkInTime,
        latitude: visit.checkInLatitude,
        longitude: visit.checkInLongitude,
        address: visit.checkInAddress,
        title: visit.customerName,
      }),
      checkOut: this.toJourneyEvent('VISIT', {
        id: visit.id,
        time: visit.checkOutTime,
        latitude: visit.checkOutLatitude,
        longitude: visit.checkOutLongitude,
        address: visit.checkOutAddress,
        title: visit.customerName,
      }),
    }));

    const journeys: AdminGpsHistoryJourney[] = [];
    let journeyId = 1;

    const firstVisitCheckIn = visitEvents[0]?.checkIn;
    if (attendanceEvent && firstVisitCheckIn) {
      journeys.push(this.buildJourney(journeyId++, attendanceEvent, firstVisitCheckIn));
    }

    for (let index = 0; index < visitEvents.length - 1; index += 1) {
      const currentVisit = visitEvents[index];
      const nextVisit = visitEvents[index + 1];
      const startEvent = currentVisit.checkIn;
      const endEvent = nextVisit.checkIn;

      if (startEvent && endEvent) {
        journeys.push(this.buildJourney(journeyId++, startEvent, endEvent));
      }
    }

    const lastVisit = visitEvents[visitEvents.length - 1];
    const lastVisitEvent = lastVisit?.checkOut || lastVisit?.checkIn;
    if (lastVisitEvent && dayoverEvent) {
      journeys.push(this.buildJourney(journeyId++, lastVisitEvent, dayoverEvent));
    }

    if (journeys.length > 0) {
      const pointCounts = await Promise.all(
        journeys.map((journey) =>
          db.GpsHistory.count({
            where: {
              hostId,
              userId,
              isDeleted: 0,
              createdAt: {
                [Op.between]: [journey.startEvent.time, journey.endEvent.time],
              },
            },
          })
        )
      );

      journeys.forEach((journey, index) => {
        const gpsPointCount = pointCounts[index] || 0;
        if (gpsPointCount > 0) {
          journey.gpsPointCount = gpsPointCount;
        }
      });
    }

    const coordinates = this.extractCoordinates(journeys);
    const totalDistanceKm = journeys.reduce((sum, journey) => sum + journey.distanceKm, 0);

    const attendanceTime = attendanceJson?.attendanceTime || null;
    const dayoverTime = attendanceJson?.dayoverTime || null;
    const workingMinutes =
      attendanceTime && dayoverTime && dayoverTime >= attendanceTime
        ? Math.round((dayoverTime - attendanceTime) / 60)
        : Math.max(0, Math.round((attendanceJson?.workingHours || 0) * 60));

    return {
      employee: {
        userId: Number(userJson?.id || userId),
        code: userJson?.employeeCode || '',
        name: userJson?.name || '',
        designation: designationName,
        mobileNumber: userJson?.mobile || '',
        profileImageUrl: userJson?.profileImageUrl || '',
      },
      summary: {
        attendanceTime,
        dayoverTime,
        workingMinutes,
        totalDistanceKm: this.roundToOneDecimal(totalDistanceKm),
        visitCount: visitsJson.length,
        orderCount,
        paymentCount,
        feedbackCount,
        imageCount,
      },
      journeys,
      mapBounds: {
        north: coordinates.length ? Math.max(...coordinates.map((point) => point.latitude)) : 0,
        south: coordinates.length ? Math.min(...coordinates.map((point) => point.latitude)) : 0,
        east: coordinates.length ? Math.max(...coordinates.map((point) => point.longitude)) : 0,
        west: coordinates.length ? Math.min(...coordinates.map((point) => point.longitude)) : 0,
      },
    };
  }

  async getAdminGpsHistoryJourneyReport(
    params: AdminGpsHistoryJourneyReportQuery
  ): Promise<AdminGpsHistoryJourneyResponse> {
    const { hostId, userId, startTime, endTime } = params;

    const gpsRows = await db.GpsHistory.findAll({
      attributes: ['createdAt', 'latitude', 'longitude', 'accuracy', 'speed', 'provider'],
      where: {
        hostId,
        userId,
        isDeleted: 0,
        createdAt: {
          [Op.between]: [startTime, endTime],
        },
      },
      order: [['createdAt', 'ASC']],
    });

    const gpsPoints: AdminGpsHistoryJourneyPoint[] = gpsRows.map((row) => {
      const point = row.toJSON() as Record<string, unknown>;
      const timestamp = this.toNonNegativeInteger(point.createdAt);
      return {
        time: timestamp,
        timestamp,
        latitude: this.toFiniteNumber(point.latitude as number | string | undefined) || 0,
        longitude: this.toFiniteNumber(point.longitude as number | string | undefined) || 0,
        accuracy: this.toNonNegativeInteger(point.accuracy),
        speed: this.toNonNegativeInteger(point.speed),
        provider: String(point.provider || ''),
      };
    });

    let distanceKm = 0;
    let travelSeconds = 0;
    let maximumSpeed = 0;
    let movingSpeedSum = 0;
    let movingPointCount = 0;

    for (let index = 0; index < gpsPoints.length; index += 1) {
      const currentPoint = gpsPoints[index];
      maximumSpeed = Math.max(maximumSpeed, currentPoint.speed);

      if (currentPoint.speed > 0) {
        movingSpeedSum += currentPoint.speed;
        movingPointCount += 1;
      }

      if (index === gpsPoints.length - 1) {
        continue;
      }

      const nextPoint = gpsPoints[index + 1];
      distanceKm += this.calculateDistanceKm(
        currentPoint.latitude,
        currentPoint.longitude,
        nextPoint.latitude,
        nextPoint.longitude
      );

      const intervalSeconds = Math.max(0, nextPoint.timestamp - currentPoint.timestamp);
      if (currentPoint.speed > 0) {
        travelSeconds += intervalSeconds;
      }
    }

    const durationMinutes = Math.max(0, Math.round((endTime - startTime) / 60));
    const travelMinutes = Math.min(durationMinutes, Math.round(travelSeconds / 60));
    const idleMinutes = Math.max(0, durationMinutes - travelMinutes);
    const averageSpeed = movingPointCount > 0 ? Math.round(movingSpeedSum / movingPointCount) : 0;

    return {
      summary: {
        distanceKm: this.roundToOneDecimal(distanceKm),
        durationMinutes,
        travelMinutes,
        idleMinutes,
        averageSpeed,
        maximumSpeed,
      },
      gpsPoints,
    };
  }

  private toJourneyEvent(
    type: 'ATTENDANCE' | 'VISIT' | 'DAYOVER',
    source: {
      id?: number;
      time?: number;
      latitude?: number | string;
      longitude?: number | string;
      address?: string;
      title?: string;
    }
  ): AdminGpsHistoryJourneyEvent | null {
    if (!source.id || !source.time) {
      return null;
    }

    const latitude = this.toFiniteNumber(source.latitude);
    const longitude = this.toFiniteNumber(source.longitude);

    if (latitude === null || longitude === null) {
      return null;
    }

    return {
      type,
      id: source.id,
      time: source.time,
      timestamp: source.time,
      latitude,
      longitude,
      address: source.address || '',
      title: source.title,
    };
  }

  private buildJourney(
    journeyId: number,
    startEvent: AdminGpsHistoryJourneyEvent,
    endEvent: AdminGpsHistoryJourneyEvent
  ): AdminGpsHistoryJourney {
    const distanceKm = this.calculateDistanceKm(
      startEvent.latitude,
      startEvent.longitude,
      endEvent.latitude,
      endEvent.longitude
    );
    const durationMinutes = Math.max(0, Math.round((endEvent.time - startEvent.time) / 60));

    return {
      journeyId,
      title: `${this.resolveEventTitle(startEvent)} → ${this.resolveEventTitle(endEvent)}`,
      distanceKm: this.roundToOneDecimal(distanceKm),
      durationMinutes,
      routeType: 'ESTIMATED',
      startEvent,
      endEvent,
    };
  }

  private resolveEventTitle(event: AdminGpsHistoryJourneyEvent): string {
    if (event.type === 'ATTENDANCE') {
      return 'Attendance';
    }
    if (event.type === 'DAYOVER') {
      return 'Day Over';
    }

    return event.title || 'Visit';
  }

  private extractCoordinates(journeys: AdminGpsHistoryJourney[]): Array<{ latitude: number; longitude: number }> {
    const coordinates: Array<{ latitude: number; longitude: number }> = [];

    journeys.forEach((journey) => {
      coordinates.push({
        latitude: journey.startEvent.latitude,
        longitude: journey.startEvent.longitude,
      });
      coordinates.push({
        latitude: journey.endEvent.latitude,
        longitude: journey.endEvent.longitude,
      });
    });

    return coordinates;
  }

  private calculateDistanceKm(startLat: number, startLng: number, endLat: number, endLng: number): number {
    const earthRadiusKm = 6371;
    const deltaLat = this.degreesToRadians(endLat - startLat);
    const deltaLng = this.degreesToRadians(endLng - startLng);

    const a =
      Math.sin(deltaLat / 2) * Math.sin(deltaLat / 2) +
      Math.cos(this.degreesToRadians(startLat)) *
        Math.cos(this.degreesToRadians(endLat)) *
        Math.sin(deltaLng / 2) *
        Math.sin(deltaLng / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
    return earthRadiusKm * c;
  }

  private degreesToRadians(value: number): number {
    return value * (Math.PI / 180);
  }

  private toFiniteNumber(value?: number | string): number | null {
    if (value === undefined || value === null || value === '') {
      return null;
    }

    const parsedValue = Number(value);
    return Number.isFinite(parsedValue) ? parsedValue : null;
  }

  private roundToOneDecimal(value: number): number {
    return Math.round(value * 10) / 10;
  }

  private toNonNegativeInteger(value: unknown): number {
    const parsedValue = Number(value);
    if (!Number.isFinite(parsedValue) || parsedValue < 0) {
      return 0;
    }

    return Math.floor(parsedValue);
  }
}

export default new GpsHistoryReportRepository();