import { Response, NextFunction } from 'express';
import reportService from '../services/report.app.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { AttendanceReportPayload, GpsHistoryReportPayload } from '../types/report.types';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

export class ReportController {
  async getAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, userId, year, month} = req.body;

    if (!hostId || !userId || !year || !month) {
      res.status(400).json({
        success: false,
        message: 'Required fields are missing',
      } as ApiResponse);
      return;
    }

    const { fromDate, tillDate } = DateTimeFormatUtil.getUnixDateRange({ year, month });

    try {
      const report = await reportService.getAttendanceReport({ hostId, userId, filter: { fromDate, tillDate } });
      res.json({
        success: true,
        message: 'Attendance report retrieved successfully',
        data: report,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, userId, filter } = req.body;

    if (!hostId || !userId || !filter) {
      res.status(400).json({
        success: false,
        message: 'Required fields are missing',
      } as ApiResponse);
      return;
    }

    try {
      const report = await reportService.getOrdersReport({ hostId, userId, filter });
      res.json({
        success: true,
        message: 'Orders report retrieved successfully',
        data: report,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new ReportController();