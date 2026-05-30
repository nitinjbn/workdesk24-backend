import { BaseRepository } from '../../../shared/repositories/base.repository';
import Attendance from '../../../models/schemas/Attendance';
import { WhereOptions, Op } from 'sequelize';

export class AttendanceRepository extends BaseRepository<typeof Attendance.prototype> {
  constructor() {
    super(Attendance as any);
  }

  async findByUserId(userId: number): Promise<typeof Attendance.prototype[]> {
    return this.findAll({
      where: { userId } as WhereOptions<typeof Attendance.prototype>,
      order: [['checkInTime', 'DESC']],
    });
  }

  async findByLocalId(userId: number, localId: string): Promise<typeof Attendance.prototype | null> {
    return this.findOne({
      userId,
      localId,
    } as WhereOptions<typeof Attendance.prototype>);
  }

  async findByDateRange(userId: number, startTime: number, endTime: number): Promise<typeof Attendance.prototype[]> {
    return this.findAll({
      where: {
        userId,
        checkInTime: {
          [Op.between]: [startTime, endTime],
        },
      } as WhereOptions<typeof Attendance.prototype>,
      order: [['checkInTime', 'DESC']],
    });
  }

  async findActiveCheckIn(userId: number): Promise<typeof Attendance.prototype | null> {
    return this.findOne({
      userId,
      status: 'checked_in',
    } as WhereOptions<typeof Attendance.prototype>);
  }
}

export default new AttendanceRepository();
