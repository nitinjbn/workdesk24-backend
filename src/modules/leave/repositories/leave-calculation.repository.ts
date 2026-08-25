import { Op } from 'sequelize';
import {
  Holiday,
  HolidayCalendar,
  LeaveBalance,
  LeavePolicy,
  LeavePolicyRule,
  LeaveRequest,
  LeaveType,
  LeaveYear,
  User,
} from '../../../models';

export class LeaveCalculationRepository {
  async getUserWithLeaveConfig(hostId: number, userId: number): Promise<any | null> {
    return User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      include: [
        {
          model: HolidayCalendar,
          as: 'holidayCalendar',
          required: false,
          where: {
            hostId,
            isDeleted: 0,
          },
          include: [
            {
              model: LeaveYear,
              as: 'leaveYear',
              required: false,
              where: {
                hostId,
                isDeleted: 0,
              },
            },
          ],
        },
        {
          model: LeavePolicy,
          as: 'leavePolicy',
          required: false,
          where: {
            hostId,
            isDeleted: 0,
          },
        },
      ],
    } as any);
  }

  async getDefaultHolidayCalendarByLeaveYear(
    hostId: number,
    leaveYearId: number
  ): Promise<any | null> {
    return HolidayCalendar.findOne({
      where: {
        hostId,
        leaveYearId,
        isDefault: 1,
        isEnabled: 1,
        isDeleted: 0,
      },
      include: [
        {
          model: LeaveYear,
          as: 'leaveYear',
          required: true,
          where: {
            hostId,
            id: leaveYearId,
            isDeleted: 0,
          },
        },
      ],
    } as any);
  }

  async getLeaveType(hostId: number, leaveTypeId: number): Promise<any | null> {
    return LeaveType.findOne({
      where: {
        hostId,
        id: leaveTypeId,
        isDeleted: 0,
        isEnabled: 1,
      },
    } as any);
  }

  async resolveLeaveYearForDate(hostId: number, date: string): Promise<any | null> {
    return LeaveYear.findOne({
      where: {
        hostId,
        isDeleted: 0,
        startDate: {
          [Op.lte]: date,
        },
        endDate: {
          [Op.gte]: date,
        },
      },
    } as any);
  }

  async getLeavePolicyRule(payload: {
    hostId: number;
    leavePolicyId: number;
    leaveTypeId: number;
  }): Promise<any | null> {
    const { hostId, leavePolicyId, leaveTypeId } = payload;

    return LeavePolicyRule.findOne({
      where: {
        hostId,
        leavePolicyId,
        leaveTypeId,
        isDeleted: 0,
        isEnabled: 1,
      },
    } as any);
  }

  async getHolidaysBetween(payload: {
    hostId: number;
    holidayCalendarId: number;
    fromDate: string;
    tillDate: string;
  }): Promise<any[]> {
    const { hostId, holidayCalendarId, fromDate, tillDate } = payload;

    return Holiday.findAll({
      where: {
        hostId,
        holidayCalendarId,
        isDeleted: 0,
        isEnabled: 1,
        holidayDate: {
          [Op.gte]: fromDate,
          [Op.lte]: tillDate,
        },
      },
      order: [['holidayDate', 'ASC']],
    } as any);
  }

  async getLeaveBalance(payload: {
    hostId: number;
    userId: number;
    leaveYearId: number;
    leaveTypeId: number;
  }): Promise<any | null> {
    const { hostId, userId, leaveYearId, leaveTypeId } = payload;

    return LeaveBalance.findOne({
      where: {
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        isDeleted: 0,
      },
    } as any);
  }

  async findOverlappingLeaveRequests(payload: {
    hostId: number;
    userId: number;
    fromDate: string;
    tillDate: string;
    excludeLeaveRequestId?: number;
  }): Promise<any[]> {
    const { hostId, userId, fromDate, tillDate, excludeLeaveRequestId } = payload;

    const where: any = {
      hostId,
      userId,
      isDeleted: 0,
      status: {
        [Op.in]: ['DRAFT', 'PENDING', 'APPROVED'],
      },
      fromDate: {
        [Op.lte]: tillDate,
      },
      tillDate: {
        [Op.gte]: fromDate,
      },
    };

    if (excludeLeaveRequestId) {
      where.id = {
        [Op.ne]: excludeLeaveRequestId,
      };
    }

    return LeaveRequest.findAll({
      where,
      order: [['fromDate', 'ASC']],
    } as any);
  }
}

export default new LeaveCalculationRepository();
