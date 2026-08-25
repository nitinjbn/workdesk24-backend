import { Response, NextFunction } from 'express';
import leaveTypeService from '../services/leave-type.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';

export class LeaveTypeController {
  async getLeaveTypes(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { filter, page, limit, sortBy, sortOrder } = req.body;

      const result = await leaveTypeService.getLeaveTypes({
        hostId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Leave types retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getLeaveTypeById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leaveTypeId } = req.body;

      if (!leaveTypeId) {
        res.status(400).json({
          success: false,
          message: 'Leave type ID is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveTypeService.getLeaveTypeById({
        hostId,
        leaveTypeId,
      });

      res.json({
        success: true,
        message: 'Leave type retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createLeaveType(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const {
        name,
        code,
        description,
        isPaid,
        allowHalfDay,
        allowPastDate,
        allowFutureDate,
        requiresDocument,
        documentAfterDays,
        color,
      } = req.body;

      const result = await leaveTypeService.createLeaveType({
        hostId,
        name,
        code,
        description,
        isPaid,
        allowHalfDay,
        allowPastDate,
        allowFutureDate,
        requiresDocument,
        documentAfterDays,
        color,
      });

      res.json({
        success: true,
        message: 'Leave type created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateLeaveType(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const {
        leaveTypeId,
        name,
        code,
        description,
        isPaid,
        allowHalfDay,
        allowPastDate,
        allowFutureDate,
        requiresDocument,
        documentAfterDays,
        color,
      } = req.body;

      if (!leaveTypeId) {
        res.status(400).json({
          success: false,
          message: 'Leave type ID is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveTypeService.updateLeaveType({
        hostId,
        leaveTypeId,
        name,
        code,
        description,
        isPaid,
        allowHalfDay,
        allowPastDate,
        allowFutureDate,
        requiresDocument,
        documentAfterDays,
        color,
      });

      res.json({
        success: true,
        message: 'Leave type updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async enableDisableLeaveType(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leaveTypeId, isEnabled } = req.body;

      if (!leaveTypeId || isEnabled === undefined) {
        res.status(400).json({
          success: false,
          message: 'Leave type ID and isEnabled flag are required',
        } as ApiResponse);
        return;
      }

      const result = await leaveTypeService.enableDisableLeaveType({
        hostId,
        leaveTypeId,
        isEnabled,
      });

      res.json({
        success: true,
        message: `Leave type ${isEnabled ? 'enabled' : 'disabled'} successfully`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteLeaveType(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leaveTypeId } = req.body;

      if (!leaveTypeId) {
        res.status(400).json({
          success: false,
          message: 'Leave type ID is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveTypeService.deleteLeaveType({
        hostId,
        leaveTypeId,
      });

      res.json({
        success: true,
        message: 'Leave type deleted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new LeaveTypeController();
