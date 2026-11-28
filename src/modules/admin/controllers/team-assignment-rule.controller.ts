import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { createConfiguredError } from '../../../shared/utils/error.util';
import ruleService from '../../auth/services/team-assignment-rule.service';

export class TeamAssignmentRuleController {
  private async respond(
    req: AuthRequest, res: Response, next: NextFunction,
    action: 'create' | 'list' | 'update' | 'remove', message: string
  ): Promise<void> {
    try {
      const body = req.body === undefined ? {} : req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw createConfiguredError('VALIDATION_ERROR', 'Request body must be an object', 400, 'VALIDATION_ERROR');
      }
      const data = await ruleService[action]({
        hostId: Number(req.user?.hostId),
        isAdmin: Number(req.user?.isAdminUser) === 1 ||
          (req.authContext?.isSupportSession === true && Number(req.user?.isSuperAdmin) === 1),
        ruleId: body.ruleId,
        sourceTeamId: body.sourceTeamId,
        targetTeamId: body.targetTeamId,
        allowCustomerAssignment: body.allowCustomerAssignment,
        allowScheduleVisit: body.allowScheduleVisit,
        allowRescheduleVisit: body.allowRescheduleVisit,
        isEnabled: body.isEnabled,
      });
      res.json({ success: true, message, data });
    } catch (error) {
      next(error);
    }
  }

  create = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'create', 'Team assignment rule created successfully');
  list = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'list', 'Team assignment rules retrieved successfully');
  update = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'update', 'Team assignment rule updated successfully');
  remove = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'remove', 'Team assignment rule deleted successfully');
}

export default new TeamAssignmentRuleController();
