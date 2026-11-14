import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { createConfiguredError } from '../../../shared/utils/error.util';
import tagService from '../services/task-tag.service';

export class TaskTagController {
  private async respond(
    req: AuthRequest, res: Response, next: NextFunction,
    action: 'list' | 'listEnabled' | 'create' | 'update' | 'detail' | 'remove' | 'toggleStatus',
    message: string
  ): Promise<void> {
    try {
      const body = req.body === undefined ? {} : req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw createConfiguredError('INVALID_TASK_TAG_REQUEST', 'Request body must be an object', 400, 'INVALID_TASK_TAG_REQUEST');
      }
      const data = await tagService[action]({
        ...body,
        hostId: Number(req.user!.hostId),
        isAdmin: Number(req.user!.isAdminUser) === 1 || req.authContext?.isSupportSession === true,
      });
      res.json({ success: true, message, data });
    } catch (error) {
      next(error);
    }
  }

  list = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'list', 'Task tags retrieved successfully');
  listEnabled = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'listEnabled', 'Enabled task tags retrieved successfully');
  create = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'create', 'Task tag created successfully');
  update = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'update', 'Task tag updated successfully');
  detail = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'detail', 'Task tag retrieved successfully');
  remove = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'remove', 'Task tag deleted successfully');
  toggleStatus = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'toggleStatus', 'Task tag status updated successfully');
}

export default new TaskTagController();
