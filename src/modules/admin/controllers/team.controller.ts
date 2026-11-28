import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { createConfiguredError } from '../../../shared/utils/error.util';
import teamService from '../../auth/services/team.service';

export class TeamController {
  private async respond(
    req: AuthRequest, res: Response, next: NextFunction,
    action: 'create' | 'list' | 'detail' | 'update' | 'remove' | 'listMembers' | 'addMember' | 'updateMember' | 'removeMember',
    message: string
  ): Promise<void> {
    try {
      const body = req.body === undefined ? {} : req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw createConfiguredError('VALIDATION_ERROR', 'Request body must be an object', 400, 'VALIDATION_ERROR');
      }
      const data = await teamService[action]({
        hostId: Number(req.user?.hostId),
        isAdmin: Number(req.user?.isAdminUser) === 1 ||
          (req.authContext?.isSupportSession === true && Number(req.user?.isSuperAdmin) === 1),
        teamName: body.teamName,
        isEnabled: body.isEnabled,
        teamId: body.teamId,
        userId: body.userId,
        search: body.search,
        page: body.page,
        limit: body.limit,
      });
      res.json({ success: true, message, data });
    } catch (error) {
      next(error);
    }
  }

  create = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'create', 'Team created successfully');
  list = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'list', 'Teams retrieved successfully');
  detail = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'detail', 'Team retrieved successfully');
  update = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'update', 'Team updated successfully');
  remove = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'remove', 'Team deleted successfully');
  listMembers = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'listMembers', 'Team members retrieved successfully');
  addMember = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'addMember', 'Team member added successfully');
  updateMember = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'updateMember', 'Team member updated successfully');
  removeMember = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'removeMember', 'Team member removed successfully');
}

export default new TeamController();
