import { Response, NextFunction } from 'express';
import leaveYearService from '../services/leave-year.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';

export class LeaveYearController {
  async getLeaveYears(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { filter, page, limit, sortBy, sortOrder } = req.body;

      const result = await leaveYearService.getLeaveYears({
        hostId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Leave years retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getLeaveYearById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leaveYearId } = req.body;

      if (!leaveYearId) {
        res.status(400).json({
          success: false,
          message: 'Leave year ID is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveYearService.getLeaveYearById({
        hostId,
        leaveYearId,
      });

      res.json({
        success: true,
        message: 'Leave year retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createLeaveYear(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { year, startDate, endDate } = req.body;

      const result = await leaveYearService.createLeaveYear({
        hostId,
        year,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        message: 'Leave year created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateLeaveYear(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leaveYearId, year, startDate, endDate } = req.body;

      if (!leaveYearId) {
        res.status(400).json({
          success: false,
          message: 'Leave year ID is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveYearService.updateLeaveYear({
        hostId,
        leaveYearId,
        year,
        startDate,
        endDate,
      });

      res.json({
        success: true,
        message: 'Leave year updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteLeaveYear(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leaveYearId } = req.body;

      if (!leaveYearId) {
        res.status(400).json({
          success: false,
          message: 'Leave year ID is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveYearService.deleteLeaveYear({
        hostId,
        leaveYearId,
      });

      res.json({
        success: true,
        message: 'Leave year deleted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new LeaveYearController();
