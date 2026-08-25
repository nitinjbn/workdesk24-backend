import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { ApiResponse } from '../../../shared/types/base.types';
import leaveBalanceService from '../services/leave-balance.service';

export class LeaveBalanceController {
  async getEmployeeLeaveBalances(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { userId, filter, page, limit, sortBy, sortOrder } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'userId is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveBalanceService.getEmployeeLeaveBalances({
        hostId,
        userId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Employee leave balances retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getEmployeeBalanceForLeaveYear(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { userId, leaveYearId } = req.body;

      if (!userId || !leaveYearId) {
        res.status(400).json({
          success: false,
          message: 'userId and leaveYearId are required',
        } as ApiResponse);
        return;
      }

      const result = await leaveBalanceService.getEmployeeBalanceForLeaveYear({
        hostId,
        userId,
        leaveYearId,
      });

      res.json({
        success: true,
        message: 'Employee leave year balance retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getBalanceByLeaveType(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { userId, leaveTypeId, leaveYearId } = req.body;

      if (!userId || !leaveTypeId) {
        res.status(400).json({
          success: false,
          message: 'userId and leaveTypeId are required',
        } as ApiResponse);
        return;
      }

      const result = await leaveBalanceService.getBalanceByLeaveType({
        hostId,
        userId,
        leaveTypeId,
        leaveYearId,
      });

      res.json({
        success: true,
        message: 'Leave type balance retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getBalanceTransactionHistory(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { userId, filter, page, limit, sortBy, sortOrder } = req.body;

      if (!userId) {
        res.status(400).json({
          success: false,
          message: 'userId is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveBalanceService.getBalanceTransactionHistory({
        hostId,
        userId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Leave balance transaction history retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async manualBalanceAdjustment(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const createdBy = req.user!.id;
      const { userId, leaveYearId, leaveTypeId, quantity, reason } = req.body;

      if (!userId || !leaveYearId || !leaveTypeId || quantity === undefined) {
        res.status(400).json({
          success: false,
          message: 'userId, leaveYearId, leaveTypeId, and quantity are required',
        } as ApiResponse);
        return;
      }

      const result = await leaveBalanceService.manualBalanceAdjustment({
        hostId,
        userId,
        leaveYearId,
        leaveTypeId,
        quantity,
        reason,
        createdBy,
      });

      res.json({
        success: true,
        message: 'Leave balance adjusted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new LeaveBalanceController();
