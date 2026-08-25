import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { ApiResponse } from '../../../shared/types/base.types';
import leavePolicyService from '../services/leave-policy.service';

export class LeavePolicyController {
  async createLeavePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const {
        name,
        description,
        effectiveFrom,
        effectiveTill,
        isDefault,
        isEnabled,
        rules,
      } = req.body;

      const result = await leavePolicyService.createLeavePolicy({
        hostId,
        name,
        description,
        effectiveFrom,
        effectiveTill,
        isDefault,
        isEnabled,
        rules,
      });

      res.json({
        success: true,
        message: 'Leave policy created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getLeavePolicies(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { filter, page, limit, sortBy, sortOrder } = req.body;

      const result = await leavePolicyService.getLeavePolicies({
        hostId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Leave policies retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getLeavePolicyById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leavePolicyId } = req.body;

      if (!leavePolicyId) {
        res.status(400).json({
          success: false,
          message: 'leavePolicyId is required',
        } as ApiResponse);
        return;
      }

      const result = await leavePolicyService.getLeavePolicyById({
        hostId,
        leavePolicyId,
      });

      res.json({
        success: true,
        message: 'Leave policy retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateLeavePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const {
        leavePolicyId,
        name,
        description,
        effectiveFrom,
        effectiveTill,
        isDefault,
        isEnabled,
        rules,
      } = req.body;

      if (!leavePolicyId) {
        res.status(400).json({
          success: false,
          message: 'leavePolicyId is required',
        } as ApiResponse);
        return;
      }

      const result = await leavePolicyService.updateLeavePolicy({
        hostId,
        leavePolicyId,
        name,
        description,
        effectiveFrom,
        effectiveTill,
        isDefault,
        isEnabled,
        rules,
      });

      res.json({
        success: true,
        message: 'Leave policy updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async enableDisableLeavePolicy(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leavePolicyId, isEnabled } = req.body;

      if (!leavePolicyId || isEnabled === undefined) {
        res.status(400).json({
          success: false,
          message: 'leavePolicyId and isEnabled are required',
        } as ApiResponse);
        return;
      }

      const result = await leavePolicyService.enableDisableLeavePolicy({
        hostId,
        leavePolicyId,
        isEnabled,
      });

      res.json({
        success: true,
        message: `Leave policy ${isEnabled === 1 ? 'enabled' : 'disabled'} successfully`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteLeavePolicy(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leavePolicyId } = req.body;

      if (!leavePolicyId) {
        res.status(400).json({
          success: false,
          message: 'leavePolicyId is required',
        } as ApiResponse);
        return;
      }

      const result = await leavePolicyService.deleteLeavePolicy({
        hostId,
        leavePolicyId,
      });

      res.json({
        success: true,
        message: 'Leave policy deleted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async setLeavePolicyAsDefault(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leavePolicyId } = req.body;

      if (!leavePolicyId) {
        res.status(400).json({
          success: false,
          message: 'leavePolicyId is required',
        } as ApiResponse);
        return;
      }

      const result = await leavePolicyService.setLeavePolicyAsDefault({
        hostId,
        leavePolicyId,
      });

      res.json({
        success: true,
        message: 'Leave policy set as default successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async addLeaveTypeRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const {
        leavePolicyId,
        leaveTypeId,
        annualEntitlement,
        accrualType,
        allowCarryForward,
        maxCarryForward,
        allowEncashment,
        allowHalfDay,
        minimumNoticeDays,
        maximumAdvanceDays,
        maximumConsecutiveDays,
        allowNegativeBalance,
        requiresApproval,
        isEnabled,
      } = req.body;

      const result = await leavePolicyService.addLeaveTypeRule({
        hostId,
        leavePolicyId,
        leaveTypeId,
        annualEntitlement,
        accrualType,
        allowCarryForward,
        maxCarryForward,
        allowEncashment,
        allowHalfDay,
        minimumNoticeDays,
        maximumAdvanceDays,
        maximumConsecutiveDays,
        allowNegativeBalance,
        requiresApproval,
        isEnabled,
      });

      res.json({
        success: true,
        message: 'Leave policy rule added successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateLeaveTypeRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const {
        ruleId,
        leaveTypeId,
        annualEntitlement,
        accrualType,
        allowCarryForward,
        maxCarryForward,
        allowEncashment,
        allowHalfDay,
        minimumNoticeDays,
        maximumAdvanceDays,
        maximumConsecutiveDays,
        allowNegativeBalance,
        requiresApproval,
        isEnabled,
      } = req.body;

      if (!ruleId) {
        res.status(400).json({
          success: false,
          message: 'ruleId is required',
        } as ApiResponse);
        return;
      }

      const result = await leavePolicyService.updateLeaveTypeRule({
        hostId,
        ruleId,
        leaveTypeId,
        annualEntitlement,
        accrualType,
        allowCarryForward,
        maxCarryForward,
        allowEncashment,
        allowHalfDay,
        minimumNoticeDays,
        maximumAdvanceDays,
        maximumConsecutiveDays,
        allowNegativeBalance,
        requiresApproval,
        isEnabled,
      });

      res.json({
        success: true,
        message: 'Leave policy rule updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteLeaveTypeRule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { ruleId } = req.body;

      if (!ruleId) {
        res.status(400).json({
          success: false,
          message: 'ruleId is required',
        } as ApiResponse);
        return;
      }

      const result = await leavePolicyService.deleteLeaveTypeRule({
        hostId,
        ruleId,
      });

      res.json({
        success: true,
        message: 'Leave policy rule deleted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getLeavePolicyRules(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leavePolicyId, filter, page, limit, sortBy, sortOrder } = req.body;

      if (!leavePolicyId) {
        res.status(400).json({
          success: false,
          message: 'leavePolicyId is required',
        } as ApiResponse);
        return;
      }

      const result = await leavePolicyService.getLeavePolicyRules({
        hostId,
        leavePolicyId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Leave policy rules retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new LeavePolicyController();
