import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import visitPlanService from '../services/visit-plan.service';
import { createConfiguredError } from '../../../shared/utils/error.util';

export class VisitPlanController {
  private authUser(req: AuthRequest) {
    const hostId = Number(req.user?.hostId);
    const id = Number(req.user?.id);
    if (!Number.isSafeInteger(hostId) || hostId <= 0 || !Number.isSafeInteger(id) || id <= 0) {
      throw createConfiguredError('AUTH_REQUIRED', 'Authentication required', 401);
    }
    return {
      id,
      hostId,
      isAdminUser: req.user?.isAdminUser,
      isFieldAppUser: req.user?.isFieldAppUser,
      isSuperAdmin: req.user?.isSuperAdmin,
    };
  }

  async schedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.schedule(this.authUser(req), req.body ?? {});
      res.status(201).json({ success: true, message: 'Visit scheduled successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async reschedule(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.reschedule(this.authUser(req), req.body ?? {});
      res.json({ success: true, message: 'Visit rescheduled successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async reschedulePreparation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.reschedulePreparation(this.authUser(req), req.body ?? {});
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async rescheduleV2(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.rescheduleV2(this.authUser(req), req.body ?? {});
      res.json({ success: true, data });
    } catch (error) {
      next(error);
    }
  }

  async today(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.list(this.authUser(req), req.body ?? {}, 'today');
      res.json({ success: true, message: 'Today visits retrieved successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async upcoming(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.list(this.authUser(req), req.body ?? {}, 'upcoming');
      res.json({ success: true, message: 'Upcoming visits retrieved successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async overdue(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.overdue(this.authUser(req), req.body ?? {});
      res.json({ success: true, message: 'Overdue visits retrieved successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async customerHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.customerHistory(this.authUser(req), req.body ?? {});
      res.json({ success: true, message: 'Customer visit history retrieved successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async details(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.details(this.authUser(req), req.body ?? {});
      res.json({ success: true, message: 'Visit details retrieved successfully', data });
    } catch (error) {
      next(error);
    }
  }

  async cancel(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const data = await visitPlanService.cancel(this.authUser(req), req.body ?? {});
      res.json({ success: true, message: 'Visit cancelled successfully', data });
    } catch (error) {
      next(error);
    }
  }
}

export default new VisitPlanController();
