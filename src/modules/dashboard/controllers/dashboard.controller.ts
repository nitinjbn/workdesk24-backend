import { Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { createConfiguredError } from '../../../shared/utils/error.util';
import dashboardService from '../services/dashboard.service';
import type { DashboardOverviewRequest } from '../types/dashboard.types';
import { dashboardOverviewSchema } from '../validators/dashboard.validator';

export class DashboardController {
  public async getOverview(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      if (!req.user) {
        throw createConfiguredError('ACCESS_DENIED', 'Unauthorized', 401, 'ACCESS_DENIED');
      }

      const parsed = dashboardOverviewSchema.safeParse(req.body || {});
      if (!parsed.success) {
        throw createConfiguredError(
          'VALIDATION_ERROR',
          parsed.error.issues[0]?.message || 'Invalid dashboard overview request',
          400,
          'VALIDATION_ERROR',
        );
      }

      const result = await dashboardService.getOverview({
        hostId: req.user.hostId,
        requestUserId: req.user.id,
        request: parsed.data as DashboardOverviewRequest,
      });

      res.json({
        success: true,
        message: 'Dashboard overview retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new DashboardController();