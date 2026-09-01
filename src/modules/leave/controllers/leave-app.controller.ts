import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { ApiResponse } from '../../../shared/types/base.types';
import leaveAppService from '../services/leave-app.service';

export class LeaveAppController {
  async getSummary(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;

      const result = await leaveAppService.getLeaveSummary({ hostId, userId });

      res.json({
        success: true,
        message: 'Leave summary retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getBalances(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { filter, page, limit } = req.body;

      const result = await leaveAppService.getLeaveBalances({
        hostId,
        userId,
        filter,
        page,
        limit,
      });

      res.json({
        success: true,
        message: 'Leave balances retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getBalancesByLeaveYear(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { leaveYearId } = req.body;

      if (!leaveYearId) {
        res.status(400).json({
          success: false,
          message: 'leaveYearId is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveAppService.getLeaveBalancesByYear({
        hostId,
        userId,
        leaveYearId,
      });

      res.json({
        success: true,
        message: 'Leave balances for year retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getLeaveTypes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;

      const result = await leaveAppService.getLeaveTypes({ hostId, userId });

      res.json({
        success: true,
        message: 'Leave types retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getHolidays(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { leaveYearId } = req.body;

      const result = await leaveAppService.getHolidays({
        hostId,
        userId,
        leaveYearId,
      });

      res.json({
        success: true,
        message: 'Holidays retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getHolidaysV1(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;

      const result = await leaveAppService.getHolidaysV1({
        hostId,
        userId,
      });

      res.json({
        success: true,
        message: 'Holidays retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getRequests(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { filter, page, limit, sortBy, sortOrder } = req.body;

      const result = await leaveAppService.getLeaveRequests({
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
        message: 'Leave requests retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getRequestById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { id } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'id is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveAppService.getLeaveRequestById({
        hostId,
        userId,
        leaveRequestId: id,
      });

      res.json({
        success: true,
        message: 'Leave request retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { leaveTypeId, fromDate, tillDate, reason, requestLocalId, days } = req.body;

      const result = await leaveAppService.createLeaveRequest({
        hostId,
        userId,
        leaveTypeId,
        fromDate,
        tillDate,
        reason,
        requestLocalId,
        days,
      });

      res.json({
        success: true,
        message: 'Leave request submitted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }


  async createRequestV1(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { fromDate, tillDate, reason, requestLocalId, days } = req.body;

      const result = await leaveAppService.createLeaveRequestV1({
        hostId,
        userId,
        fromDate,
        tillDate,
        reason,
        requestLocalId,
        days,
      });

      res.json({
        success: true,
        message: 'Leave request submitted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async submitRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { id } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'id is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveAppService.submitLeaveRequest({
        hostId,
        userId,
        leaveRequestId: id,
      });

      res.json({
        success: true,
        message: 'Leave request submitted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async cancelRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { id } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'id is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveAppService.cancelLeaveRequest({
        hostId,
        userId,
        leaveRequestId: id,
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

  async cancelRequestV1(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { id } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'id is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveAppService.cancelLeaveRequestV1({
        hostId,
        userId,
        leaveRequestId: id,
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

  async withdrawRequest(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const userId = req.user!.id;
      const { id } = req.body;

      if (!id) {
        res.status(400).json({
          success: false,
          message: 'id is required',
        } as ApiResponse);
        return;
      }

      const result = await leaveAppService.withdrawLeaveRequest({
        hostId,
        userId,
        leaveRequestId: id,
      });

      res.json({
        success: true,
        message: 'Leave request withdrawn successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new LeaveAppController();
