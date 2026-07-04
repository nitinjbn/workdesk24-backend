import { Response, NextFunction } from 'express';
import reportService from '../services/report.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { AttendanceReportPayload, GpsHistoryReportPayload, GetUsersPayload } from '../types/report.types';
import userService from '../services/user.service';

export class ReportController {
  async getAdminGpsHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => reportService.getGpsHistoryReport(payload as GpsHistoryReportPayload, scope),
      'GPS history report retrieved successfully'
    );
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

  async getDesignations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getDesignations(payload as any, scope),
      'Designations retrieved successfully'
    );
  }

  async getRoles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getRoles(payload as any, scope),
      'Roles retrieved successfully'
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

  async getAppUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getAppUsers(payload as GetUsersPayload, scope),
      'Users retrieved successfully'
    );
  }

  async getUserDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getUserDetails(payload as any, scope),
      'User details retrieved successfully'
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
}

export default new ReportController();