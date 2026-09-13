import { FindAndCountOptions, Includeable, Op } from 'sequelize';
import db, { Attendance, User } from '../../../models';
import {
  AttendanceReportFilter,
  AttendanceReportFilterWithTime,
  CommonReportSortBy,
  MonthlyAttendanceReportPayload,
  ReportResponse,
  ReportSortDirection,
} from '../types/report.types';
import baseReportHelper from '../helpers/base-report.helper';
import {
  buildCommonReportOrder,
  buildDynamicModelFilters,
  buildUserInclude,
  buildUserScopedWhere,
  extractUserFilter,
} from './user-scoped-report.helper';
import moment from 'moment-timezone';
import { CONFIG } from '../../../config/constants';

type AttendanceInstance = typeof Attendance.prototype;
const ATTENDANCE_COLUMNS = Object.keys(
  ((Attendance as any).getAttributes?.() || (Attendance as any).rawAttributes || {}) as Record<
    string,
    unknown
  >
);

export interface AttendanceReportQuery {
  hostId: number;
  page: number;
  limit: number;
  filter: AttendanceReportFilter;
  userId?: number;
  enforceActiveUsersOnly: boolean;
  sortBy: CommonReportSortBy;
  sortOrder: ReportSortDirection;
}

export interface MonthlyAttendanceSource {
  users: Array<{
    id: number;
    employeeCode?: string;
    name?: string;
    holidayCalendarId?: number;
    settings?: Array<{ settingName: string; settingValue: string }>;
  }>;
  attendance: Array<{ userId: number; attendanceTime: number; attendanceStatus?: string }>;
  leaveDates: Array<{ userId: number; leaveDate: string }>;
  holidays: Array<{ holidayCalendarId: number; holidayDate: string }>;
  pagination: ReturnType<typeof baseReportHelper.buildPagination>;
}

type MonthlyAttendanceQuery = Omit<MonthlyAttendanceReportPayload, 'filter'> & {
  filter: Omit<MonthlyAttendanceReportPayload['filter'], 'attendanceTime'> & {
    attendanceTime: { from: number; to: number };
  };
};

export class AttendanceReportRepository {
  async getMonthlyAttendanceReport(
    payload: MonthlyAttendanceQuery,
    timeZone = CONFIG.REPORTING.TIMEZONE
  ): Promise<MonthlyAttendanceSource> {
    const { hostId, filter } = payload;
    const userIds = filter.userId;
    const attendanceTime = filter.attendanceTime;

    if (!attendanceTime) {
      throw new Error('filter.attendanceTime is required for monthly attendance');
    }

    const { offset, page, limit } = baseReportHelper.normalizePagination(payload);
    const userWhere: Record<string, unknown> = { hostId, isDeleted: 0, isFieldAppUser: 1 };
    if (userIds?.length) {
      userWhere.id = { [Op.in]: userIds };
    }

    const userQuery = {
      where: userWhere,
      attributes: ['id', 'employeeCode', 'name', 'holidayCalendarId'],
      include: [
        {
          model: db.UserSettings,
          as: 'settings',
          attributes: ['settingName', 'settingValue'],
          required: false,
          where: { settingName: 'weeklyOffMask', isEnabled: 1, isDeleted: 0 },
        },
      ],
      order: [['id', 'ASC']],
      limit,
      offset,
      distinct: true,
    } as any;

    const [{ rows, count }, attendance] = await Promise.all([
      User.findAndCountAll(userQuery),
      Attendance.findAll({
        attributes: ['userId', 'attendanceTime', 'attendanceStatus'],
        where: {
          hostId,
          isDeleted: 0,
          ...(userIds?.length ? { userId: { [Op.in]: userIds } } : {}),
          attendanceTime: { [Op.gte]: attendanceTime.from, [Op.lt]: attendanceTime.to },
        },
        raw: true,
      }) as unknown as Promise<
        Array<{ userId: number; attendanceTime: number; attendanceStatus?: string }>
      >,
    ]);

    const defaultHolidayCalendar = await db.HolidayCalendar.findOne({
      attributes: ['id'],
      where: { hostId, isDefault: 1, isEnabled: 1, isDeleted: 0 },
      order: [['id', 'ASC']],
      raw: true,
    });
    const defaultHolidayCalendarId = defaultHolidayCalendar?.id as number | undefined;
    const users = rows.map((user) => {
      const plainUser = user.toJSON() as MonthlyAttendanceSource['users'][number];
      plainUser.holidayCalendarId = plainUser.holidayCalendarId || defaultHolidayCalendarId;
      return plainUser;
    });
    const selectedUserIds = users.map((user) => user.id);
    const holidayCalendarIds = users
      .map((user) => user.holidayCalendarId)
      .filter((calendarId): calendarId is number => Boolean(calendarId));
    const [leaveDates, holidays] = await Promise.all([
      db.LeaveRequestDay.findAll({
        attributes: ['userId', 'leaveDate'],
        where: {
          hostId,
          userId: { [Op.in]: selectedUserIds },
          leaveDate: {
            [Op.between]: [
              this.toDateKey(attendanceTime.from, timeZone),
              this.toDateKey(attendanceTime.to - 1, timeZone),
            ],
          },
        },
        include: [
          {
            model: db.LeaveRequest,
            as: 'leaveRequest',
            attributes: [],
            required: true,
            where: { hostId, status: 'APPROVED', isDeleted: 0 },
          },
        ],
        raw: true,
      }),
      db.Holiday.findAll({
        attributes: ['holidayCalendarId', 'holidayDate'],
        where: {
          hostId,
          isEnabled: 1,
          isDeleted: 0,
          holidayCalendarId: { [Op.in]: holidayCalendarIds },
          holidayDate: {
            [Op.between]: [
              this.toDateKey(attendanceTime.from, timeZone),
              this.toDateKey(attendanceTime.to - 1, timeZone),
            ],
          },
        },
        raw: true,
      }),
    ]);

    return {
      users,
      attendance,
      leaveDates: leaveDates as MonthlyAttendanceSource['leaveDates'],
      holidays: holidays as MonthlyAttendanceSource['holidays'],
      pagination: baseReportHelper.buildPagination(count, page, limit),
    };
  }

  private toDateKey(unixTime: number, timeZone: string): string {
    return moment.unix(unixTime).tz(timeZone).format('YYYY-MM-DD');
  }

  async getReport(params: AttendanceReportQuery): Promise<ReportResponse<AttendanceInstance>> {
    const { page, limit, filter, hostId, userId, enforceActiveUsersOnly, sortBy, sortOrder } =
      params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    const where = this.buildWhere(filter, userId);
    const userFilter = extractUserFilter(filter as Record<string, unknown>);
    const userInclude = buildUserInclude(hostId, userId, enforceActiveUsersOnly, userFilter);
    const order = buildCommonReportOrder(sortBy, sortOrder, {
      createdAt: 'createdAt',
      batteryPercentage: 'attendanceBatteryPercentage',
      speed: 'attendanceLocationSpeed',
    });

    const query: FindAndCountOptions<AttendanceInstance> = {
      attributes: {
        exclude: ['localId', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('user.name'), 'employeeName'],
          [db.Sequelize.col('user.employeeCode'), 'employeeCode'],
        ],
      },
      where,
      include: [userInclude as Includeable],
      limit,
      offset,
      order,
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    if (page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await Attendance.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
    } else {
      const rows = await Attendance.findAll(query);
      return {
        data: rows,
      };
    }
  }

  private buildWhere(filter: AttendanceReportFilter, userId?: number): Record<string, unknown> {
    const baseWhere = buildUserScopedWhere<AttendanceInstance>(filter, userId) as Record<
      string,
      unknown
    >;
    const attendanceTime = (filter as AttendanceReportFilterWithTime).attendanceTime;
    const dynamicWhere = buildDynamicModelFilters(filter, ATTENDANCE_COLUMNS, [
      'userId',
      'User',
      'user',
      'attendanceTime',
    ]);

    return {
      ...baseWhere,
      ...dynamicWhere,
      ...(attendanceTime
        ? {
            attendanceTime: {
              [Op.gte]: attendanceTime.from,
              [Op.lt]: attendanceTime.to,
            },
          }
        : {}),
    };
  }
}

export default new AttendanceReportRepository();
