import { Response, NextFunction } from 'express';
import reportService from '../services/report.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import {
  AdminGpsHistoryJourneyPayload,
  AdminGpsHistoryPayload,
  AttendanceReportPayload,
  GpsHistoryReportPayload,
} from '../types/report.types';

export class ReportController {
  async getAdminGpsHistoryJourney(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await reportService.getAdminGpsHistoryJourneyReport(
        req.body as AdminGpsHistoryJourneyPayload,
        { hostId: req.user!.hostId }
      );

      res.json({
        success: true,
        message: 'Route fetched successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getAdminGpsHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await reportService.getAdminGpsHistoryReport(
        req.body as AdminGpsHistoryPayload,
        { hostId: req.user!.hostId }
      );

      res.json({
        success: true,
        message: 'GPS history fetched successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getAppGpsHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => reportService.getGpsHistoryReport(payload as GpsHistoryReportPayload, scope),
      'GPS history report retrieved successfully',
      true
    );
  }

  async getAdminAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => reportService.getAttendanceReport(payload as AttendanceReportPayload, scope),
      'Attendance report retrieved successfully'
    );
  }

  async getAppAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => reportService.getAttendanceReport(payload as AttendanceReportPayload, scope),
      'Attendance report retrieved successfully',
      true
    );
  }

  private async executeUserScopedReport(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
    handler: (payload: Record<string, unknown>, scope: { hostId: number; requestUserId?: number }) => Promise<unknown>,
    successMessage: string,
    restrictToSelf = false
  ): Promise<void> {
    try {
      const result = await handler(req.body as Record<string, unknown>, {
        hostId: req.user!.hostId,
        requestUserId: restrictToSelf ? req.user!.id : undefined,
      });

      res.json({
        success: true,
        message: successMessage,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getVisits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const result = await reportService.getVisitsReport(payload);

      res.json({
        success: true,
        message: 'Visits report retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const result = await reportService.getOrdersReport(payload);

      res.json({
        success: true,
        message: 'Orders report retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const result = await reportService.getPaymentsReport(payload);

      res.json({
        success: true,
        message: 'Payments report retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getFeedbacks(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const result = await reportService.getFeedbacksReport(payload);

      res.json({
        success: true,
        message: 'Feedbacks report retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getImages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const result = await reportService.getImagesReport(payload);

      res.json({
        success: true,
        message: 'Images report retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getAllActivities(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const result = await reportService.getAllActivitiesReport(payload);
      res.json({
        success: true,
        message: 'All activities report retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getLastLocations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const payload = req.body;
      const result = await reportService.getLastLocationsReport(payload);
      res.json({
        success: true,
        message: 'Last locations report retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new ReportController();