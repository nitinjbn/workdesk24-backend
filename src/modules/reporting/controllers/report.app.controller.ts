import { Response, NextFunction } from 'express';
import { z } from 'zod';
import reportService from '../services/report.app.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { AttendanceReportPayload, GpsHistoryReportPayload } from '../types/report.types';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';
import { createConfiguredError } from '../../../shared/utils/error.util';

const orderDetailsSchema = z.object({
  orderId: z.union([
    z.number().int().positive().transform(String),
    z
      .string()
      .regex(/^[1-9][0-9]{0,18}$/)
      .refine((id) => id.length < 19 || id <= '9223372036854775807'),
  ]),
});

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

  async getOrderDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user?.hostId;
      if (!hostId) {
        throw createConfiguredError('AUTH_REQUIRED', 'Authentication required', 401, 'AUTH_REQUIRED');
      }

      const result = orderDetailsSchema.safeParse(req.body);
      if (!result.success) {
        throw createConfiguredError('INVALID_ORDER_ID', 'orderId must be a positive integer');
      }

      const order = await reportService.getOrderDetails({ hostId, orderId: result.data.orderId });
      res.json({
        success: true,
        message: 'Order details retrieved successfully',
        data: order,
      });
    } catch (error) {
      next(error);
    }
  }

  async getVisits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, userId, filter } = req.body;

    if (!hostId || !userId || !filter) {
      res.status(400).json({
        success: false,
        message: 'Required fields are missing',
      } as ApiResponse);
      return;
    }

    try {
      const report = await reportService.getVisitsReport({ hostId, userId, filter });
      res.json({
        success: true,
        message: 'Visits report retrieved successfully',
        data: report,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, userId, filter } = req.body;

    if (!hostId || !userId || !filter) {
      res.status(400).json({
        success: false,
        message: 'Required fields are missing',
      } as ApiResponse);
      return;
    }

    try {
      const report = await reportService.getPaymentsReport({ hostId, userId, filter });
      res.json({
        success: true,
        message: 'Payments report retrieved successfully',
        data: report,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getFeedbacks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, userId, filter } = req.body;

    if (!hostId || !userId || !filter) {
      res.status(400).json({
        success: false,
        message: 'Required fields are missing',
      } as ApiResponse);
      return;
    }

    try {
      const report = await reportService.getFeedbacksReport({ hostId, userId, filter });
      res.json({
        success: true,
        message: 'Feedbacks report retrieved successfully',
        data: report,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getImages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, userId, filter } = req.body;

    if (!hostId || !userId || !filter) {
      res.status(400).json({
        success: false,
        message: 'Required fields are missing',
      } as ApiResponse);
      return;
    }

    try {
      const report = await reportService.getImagesReport({ hostId, userId, filter });
      res.json({
        success: true,
        message: 'Images report retrieved successfully',
        data: report,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getCustomerDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, customerId } = req.body;

    if (!hostId || !customerId) {
      res.status(400).json({
        success: false,
        message: 'Required fields are missing',
      } as ApiResponse);
      return;
    }

    try {
      const report = await reportService.getCustomerDetails({ hostId, customerId });
      res.json({
        success: true,
        message: 'Customer details report retrieved successfully',
        data: report,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new ReportController();