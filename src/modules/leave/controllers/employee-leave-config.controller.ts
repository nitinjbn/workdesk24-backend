import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { ApiResponse } from '../../../shared/types/base.types';
import employeeLeaveConfigService from '../services/employee-leave-config.service';

export class EmployeeLeaveConfigController {
  async getEmployeeLeaveConfiguration(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { userId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'userId is required',
        } as ApiResponse);
        return;
      }

      const result = await employeeLeaveConfigService.getEmployeeLeaveConfiguration({
        hostId,
        userId,
      });

      res.json({
        success: true,
        message: 'Employee leave configuration retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateEmployeeLeaveConfiguration(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { userId, holidayCalendarId, leavePolicyId } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'userId is required',
        } as ApiResponse);
        return;
      }

      const result = await employeeLeaveConfigService.updateEmployeeLeaveConfiguration({
        hostId,
        userId,
        holidayCalendarId,
        leavePolicyId,
      });

      res.json({
        success: true,
        message: 'Employee leave configuration updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async bulkUpdateEmployeeLeaveConfiguration(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { employees } = req.body;

      const result = await employeeLeaveConfigService.bulkUpdateEmployeeLeaveConfiguration({
        hostId,
        employees,
      });

      res.json({
        success: true,
        message: `${result.count} employee leave configuration(s) updated successfully`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new EmployeeLeaveConfigController();
