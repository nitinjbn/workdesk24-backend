import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import { createConfiguredError } from '../../../shared/utils/error.util';
import categoryService from '../services/task-category.service';

export class TaskCategoryController {
  private async respond(req: AuthRequest, res: Response, next: NextFunction, action: 'list' | 'create' | 'update' | 'detail' | 'remove' | 'toggleStatus', message: string): Promise<void> {
    try {
      const body = req.body === undefined ? {} : req.body;
      if (!body || typeof body !== 'object' || Array.isArray(body)) {
        throw createConfiguredError('INVALID_TASK_CATEGORY_REQUEST', 'Request body must be an object', 400, 'INVALID_TASK_CATEGORY_REQUEST');
      }
      const data = await categoryService[action]({
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
    this.respond(req, res, next, 'list', 'Task categories retrieved successfully');
  create = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'create', 'Task category created successfully');
  update = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'update', 'Task category updated successfully');
  detail = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'detail', 'Task category retrieved successfully');
  remove = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'remove', 'Task category deleted successfully');
  toggleStatus = (req: AuthRequest, res: Response, next: NextFunction) =>
    this.respond(req, res, next, 'toggleStatus', 'Task category status updated successfully');
}

export default new TaskCategoryController();
