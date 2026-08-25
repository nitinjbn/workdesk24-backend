import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { ApiResponse } from '../../../shared/types/base.types';
import leaveRequestApprovalService from '../services/leave-request-approval.service';

export class LeaveRequestApprovalController {
  async listPendingLeaveRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const approverUserId = req.user!.id;
      const approverRoleId = req.user!.roleId;
      const { filter, page, limit, sortBy, sortOrder } = req.body;

      const result = await leaveRequestApprovalService.listPendingLeaveRequests({
        hostId,
        approverUserId,
        approverRoleId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Pending leave requests retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getLeaveRequestDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const approverUserId = req.user!.id;
      const approverRoleId = req.user!.roleId;
      const { leaveRequestId } = req.body;

      if (!leaveRequestId) {
        res.status(400).json({ success: false, message: 'leaveRequestId is required' } as ApiResponse);
        return;
      }

      const result = await leaveRequestApprovalService.getLeaveRequestDetails({
        hostId,
        approverUserId,
        approverRoleId,
        leaveRequestId,
      });

      res.json({
        success: true,
        message: 'Leave request details retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async approveLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const approverUserId = req.user!.id;
      const approverRoleId = req.user!.roleId;
      const { leaveRequestId, comment } = req.body;

      if (!leaveRequestId) {
        res.status(400).json({ success: false, message: 'leaveRequestId is required' } as ApiResponse);
        return;
      }

      const result = await leaveRequestApprovalService.approveLeaveRequest({
        hostId,
        approverUserId,
        approverRoleId,
        leaveRequestId,
        comment,
      });

      res.json({
        success: true,
        message: 'Leave request approved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async rejectLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const approverUserId = req.user!.id;
      const approverRoleId = req.user!.roleId;
      const { leaveRequestId, comment } = req.body;

      if (!leaveRequestId) {
        res.status(400).json({ success: false, message: 'leaveRequestId is required' } as ApiResponse);
        return;
      }

      const result = await leaveRequestApprovalService.rejectLeaveRequest({
        hostId,
        approverUserId,
        approverRoleId,
        leaveRequestId,
        comment,
      });

      res.json({
        success: true,
        message: 'Leave request rejected successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async cancelLeaveRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const approverUserId = req.user!.id;
      const approverRoleId = req.user!.roleId;
      const { leaveRequestId, comment } = req.body;

      if (!leaveRequestId) {
        res.status(400).json({ success: false, message: 'leaveRequestId is required' } as ApiResponse);
        return;
      }

      const result = await leaveRequestApprovalService.cancelLeaveRequest({
        hostId,
        approverUserId,
        approverRoleId,
        leaveRequestId,
        comment,
      });

      res.json({
        success: true,
        message: 'Leave request cancelled successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async viewApprovalHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const approverUserId = req.user!.id;
      const approverRoleId = req.user!.roleId;
      const { leaveRequestId } = req.body;

      if (!leaveRequestId) {
        res.status(400).json({ success: false, message: 'leaveRequestId is required' } as ApiResponse);
        return;
      }

      const result = await leaveRequestApprovalService.viewApprovalHistory({
        hostId,
        approverUserId,
        approverRoleId,
        leaveRequestId,
      });

      res.json({
        success: true,
        message: 'Leave request approval history retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new LeaveRequestApprovalController();
