import { Op, Transaction } from 'sequelize';
import { User, HolidayCalendar, LeavePolicy } from '../../../models';

type UserInstance = typeof User.prototype;

export class EmployeeLeaveConfigRepository {
  async getEmployeeById(
    hostId: number,
    userId: number,
    transaction?: Transaction
  ): Promise<UserInstance | null> {
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
            isDeleted: 0,
          },
        },
        {
          model: LeavePolicy,
          as: 'leavePolicy',
          required: false,
          where: {
            isDeleted: 0,
          },
        },
      ],
      transaction,
    } as any);
  }

  async getEmployeesByIds(
    hostId: number,
    userIds: number[],
    transaction?: Transaction
  ): Promise<UserInstance[]> {
    if (userIds.length === 0) {
      return [];
    }

    return User.findAll({
      where: {
        hostId,
        id: {
          [Op.in]: userIds,
        },
        isDeleted: 0,
      },
      transaction,
    } as any);
  }

  async updateEmployeeLeaveConfiguration(
    hostId: number,
    userId: number,
    data: {
      holidayCalendarId?: number | null;
      leavePolicyId?: number | null;
    },
    transaction?: Transaction
  ): Promise<UserInstance | null> {
    const user = await User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      transaction,
    } as any);

    if (!user) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    const updatePayload: any = {
      updatedAt: now,
    };

    if (Object.prototype.hasOwnProperty.call(data, 'holidayCalendarId')) {
      updatePayload.holidayCalendarId = data.holidayCalendarId ?? null;
    }

    if (Object.prototype.hasOwnProperty.call(data, 'leavePolicyId')) {
      updatePayload.leavePolicyId = data.leavePolicyId ?? null;
    }

    await user.update(updatePayload, { transaction });

    return this.getEmployeeById(hostId, userId, transaction);
  }
}

export default new EmployeeLeaveConfigRepository();
