import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { createConfiguredError } from '../../../shared/utils/error.util';
import eligibilityService from '../services/assignment-eligibility.service';

export class AssignmentEligibilityController {
  async getEligibleUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const body = req.body === undefined ? {} : req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw createConfiguredError('VALIDATION_ERROR', 'Request body must be an object', 400, 'VALIDATION_ERROR');
      }
      const data = await eligibilityService.getEligibleUsers({
        hostId: Number(req.user?.hostId),
        actorId: Number(req.user?.id),
        action: body.action,
        search: body.search,
        page: body.page,
        limit: body.limit,
      });
      res.json({ success: true, message: 'Eligible users retrieved successfully', data });
    } catch (error) {
      next(error);
    }
  }
}

export default new AssignmentEligibilityController();
