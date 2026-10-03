import { FindAndCountOptions } from 'sequelize';
import db, { Attendance } from '../../../models';

type AttendanceInstance = typeof Attendance.prototype;

export interface AttendanceReportQuery {
  hostId: number;
  userId?: number;
  filter: {
    fromDate?: number;
    tillDate?: number;
  };
}

export class AttendanceReportRepository {
  async getReport(params: AttendanceReportQuery): Promise<{ data: AttendanceInstance[] }> {
    const { hostId, userId, filter } = params;

    const where: any = {
      hostId,
      userId,
      isDeleted: 0,
    };

    if (filter.fromDate && filter.tillDate) {
      where.attendanceTime = {
        [db.Sequelize.Op.between]: [filter.fromDate, filter.tillDate],
      };
    }

    const query: FindAndCountOptions<AttendanceInstance> = {
      attributes: [
        'attendanceTime',
        'attendanceStatus',
        'vehicleType',
        'vehicleCategory',
        'attendanceOdometerReading',
        'dayoverRemarks',
        'dayoverTime',
        'autoDayover',
        'workingHours',
        'dayoverOdometerReading',
        'attendanceAddress',
        'dayoverAddress',
      ],
      where,
      include: [
        {
          model: db.User,
          attributes: [],
          as: 'user',
        },
      ],
      order: [['attendanceTime', 'ASC']],
      distinct: true,
      logging: console.log,
    };

    const rows = await Attendance.findAll(query);
    const attendanceByDate = new Map<string, any>();

    (rows || []).forEach((row: any) => {
      const dateKey = this.toDateKey(Number(row.attendanceTime));
      if (dateKey) {
        attendanceByDate.set(dateKey, row);
      }
    });

    if (!filter.fromDate || !filter.tillDate) {
      return { data: rows || [] };
    }

    const fromDateKey = this.toDateKey(filter.fromDate);
    const tillDateKey = this.toDateKey(filter.tillDate);

    if (!fromDateKey || !tillDateKey) {
      return { data: rows || [] };
    }

    const approvedLeaveDays = await db.LeaveRequestDay.findAll({
      attributes: ['leaveDate', 'userId'],
      where: {
        hostId,
        ...(userId ? { userId } : {}),
        leaveDate: {
          [db.Sequelize.Op.between]: [fromDateKey, tillDateKey],
        },
      },
      include: [
        {
          model: db.LeaveRequest,
          as: 'leaveRequest',
          required: true,
          attributes: [],
          where: {
            hostId,
            status: 'APPROVED',
            isDeleted: 0,
          },
        },
      ],
      raw: true,
    });

    const leaveDates = new Set<string>();
    const leaveRows: any[] = [];
    const holidayRows: any[] = [];

    approvedLeaveDays.forEach((day: any) => {
      const dateKey = String(day.leaveDate);
      leaveDates.add(dateKey);
    });

    const holidayDates = await this.getHolidayDates(hostId, userId, fromDateKey, tillDateKey);

    for (const dateKey of leaveDates) {
      holidayDates.delete(dateKey); // approved leave takes precedence over public holiday

      const existingAttendance = attendanceByDate.get(dateKey);

      if (existingAttendance && existingAttendance.attendanceStatus === 'Present') {
        continue;
      }

      if (existingAttendance) {
        existingAttendance.attendanceStatus = 'Leave';
        continue;
      }

      leaveRows.push(this.buildStatusRow(dateKey, 'Leave', hostId, userId));
    }

    for (const [dateKey, holidayName] of holidayDates) {
      const existingAttendance = attendanceByDate.get(dateKey);

      if (existingAttendance && existingAttendance.attendanceStatus === 'Present') {
        continue;
      }

      if (existingAttendance) {
        existingAttendance.attendanceStatus = 'Holiday';
        existingAttendance.holidayName = holidayName;
        continue;
      }

      holidayRows.push(this.buildStatusRow(dateKey, 'Holiday', hostId, userId, holidayName));
    }

    const finalRows = [...(rows || [])].map((row: any) => {
      const dateKey = this.toDateKey(Number(row.attendanceTime));
      if (dateKey && row.attendanceStatus !== 'Present') {
        if (leaveDates.has(dateKey)) {
          return {
            ...row,
            attendanceStatus: 'Leave',
          };
        }
        if (holidayDates.has(dateKey)) {
          return {
            ...row,
            attendanceStatus: 'Holiday',
            holidayName: holidayDates.get(dateKey),
          };
        }
      }
      return row;
    });

    return {
      data: [...finalRows, ...leaveRows, ...holidayRows].sort(
        (a: any, b: any) => Number(a.attendanceTime) - Number(b.attendanceTime)
      ),
    };
  }

  private async getHolidayDates(
    hostId: number,
    userId: number | undefined,
    fromDateKey: string,
    tillDateKey: string
  ): Promise<Map<string, string>> {
    const holidayCalendarId = await this.resolveHolidayCalendarId(hostId, userId);
    if (!holidayCalendarId) {
      return new Map<string, string>();
    }

    const holidays = await db.Holiday.findAll({
      attributes: ['holidayDate', 'name'],
      where: {
        hostId,
        isEnabled: 1,
        isDeleted: 0,
        holidayCalendarId,
        holidayDate: {
          [db.Sequelize.Op.between]: [fromDateKey, tillDateKey],
        },
      },
      raw: true,
    });

    return new Map<string, string>(
      holidays.map((holiday: any) => [String(holiday.holidayDate), String(holiday.name)])
    );
  }

  private async resolveHolidayCalendarId(
    hostId: number,
    userId?: number
  ): Promise<number | undefined> {
    if (userId) {
      const user = await db.User.findOne({
        attributes: ['holidayCalendarId'],
        where: { id: userId, hostId, isDeleted: 0 },
        raw: true,
      });
      if (user?.holidayCalendarId) {
        return user.holidayCalendarId;
      }
    }

    const defaultHolidayCalendar = await db.HolidayCalendar.findOne({
      attributes: ['id'],
      where: { hostId, isDefault: 1, isEnabled: 1, isDeleted: 0 },
      order: [['id', 'ASC']],
      raw: true,
    });

    return defaultHolidayCalendar?.id as number | undefined;
  }

  private buildStatusRow(
    dateKey: string,
    attendanceStatus: 'Leave' | 'Holiday',
    hostId: number,
    userId?: number,
    holidayName?: string
  ): any {
    return {
      attendanceTime: this.dateToUnixStart(dateKey),
      attendanceStatus,
      ...(holidayName ? { holidayName } : {}),
      vehicleType: null,
      vehicleCategory: null,
      attendanceOdometerReading: null,
      dayoverRemarks: null,
      dayoverTime: null,
      autoDayover: 0,
      workingHours: 0,
      dayoverOdometerReading: null,
      attendanceAddress: null,
      dayoverAddress: null,
      hostId,
      userId,
    };
  }

  private toDateKey(value: number): string | null {
    if (!value || !Number.isFinite(Number(value))) {
      return null;
    }

    const date = new Date(Number(value) * 1000);
    if (Number.isNaN(date.getTime())) {
      return null;
    }

    return date.toISOString().slice(0, 10);
  }

  private dateToUnixStart(dateKey: string): number {
    return Math.floor(new Date(`${dateKey}T00:00:00.000Z`).getTime() / 1000);
  }
}

export default new AttendanceReportRepository();
