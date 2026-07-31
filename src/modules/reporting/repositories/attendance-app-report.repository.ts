import { FindAndCountOptions } from 'sequelize';
import db, { Attendance } from '../../../models';

type AttendanceInstance = typeof Attendance.prototype;

export interface AttendanceReportQuery {
  hostId: number;
  userId?: number;
  filter: {
    fromDate?: number;
    tillDate?: number;
  }
}

export class AttendanceReportRepository {
  async getReport(params: AttendanceReportQuery): Promise<{ data: AttendanceInstance[] }> {
    const { hostId, userId, filter } = params;

    const where = {
      hostId,
      userId,
      isDeleted: 0
    }

    if(filter.fromDate && filter.tillDate) {
      where['attendanceTime'] = {
        [db.Sequelize.Op.between]: [filter.fromDate, filter.tillDate]
      }
    }

    const query: FindAndCountOptions<AttendanceInstance> = {
      attributes: ['attendanceTime', 'attendanceStatus', 'vehicleType', 'vehicleCategory', 'attendanceOdometerReading', 'dayoverRemarks', 'dayoverTime', 'autoDayover', 'workingHours', 'dayoverOdometerReading', 'attendanceAddress', 'dayoverAddress'],
      where,
      include: [
        {
          model: db.User,
          attributes: [],
          as: 'user'
        }
      ],
      order: [['attendanceTime', 'ASC']], 
      distinct: true,
      logging: console.log, // Enable logging for debugging
    };

    const rows = await Attendance.findAll(query);
    return {
      data: rows || []
    };
  }

}

export default new AttendanceReportRepository();
