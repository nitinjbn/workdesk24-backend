import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import taskService from '../services/task.service';

function identity(req: AuthRequest) {
  return {
    hostId: req.user!.hostId,
    userId: req.user!.id,
    isAdmin: Number(req.user!.isAdminUser) === 1,
  };
}

export class TaskController {
  private async respond(
    operation: () => Promise<any>,
    res: Response,
    next: NextFunction,
    message: string
  ): Promise<void> {
    try {
      res.json({ success: true, message, data: await operation() });
    } catch (error) {
      next(error);
    }
  }

  createTask = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.createTask({ ...req.body, ...identity(req) }),
      res,
      next,
      'Task created successfully'
    );

  getTasks = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.listTasks({ ...req.body, ...identity(req), filters: req.body.filters || req.body }),
      res,
      next,
      'Tasks retrieved successfully'
    );

  getTaskDetails = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.getTaskDetails({ ...identity(req), taskId: req.body.taskId }),
      res,
      next,
      'Task retrieved successfully'
    );

  updateTask = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.updateTask({ ...req.body, ...identity(req) }),
      res,
      next,
      'Task updated successfully'
    );

  assignTask = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.assignTask({ ...req.body, ...identity(req) }),
      res,
      next,
      'Task assignment updated successfully'
    );

  startTask = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.startTask({ ...identity(req), taskId: req.body.taskId }),
      res,
      next,
      'Task started successfully'
    );

  completeTask = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.completeTask({ ...identity(req), taskId: req.body.taskId, remarks: req.body.remarks }),
      res,
      next,
      'Task completed successfully'
    );

  cancelTask = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.cancelTask({ ...identity(req), taskId: req.body.taskId, remarks: req.body.remarks }),
      res,
      next,
      'Task cancelled successfully'
    );

  getTaskActivity = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.listActivity({ ...identity(req), taskId: req.body.taskId, page: req.body.page, limit: req.body.limit }),
      res,
      next,
      'Task activity retrieved successfully'
    );

  addTaskComment = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.addComment({ ...identity(req), taskId: req.body.taskId, comment: req.body.comment }),
      res,
      next,
      'Task comment added successfully'
    );

  getTaskComments = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.listComments({ ...identity(req), taskId: req.body.taskId, page: req.body.page, limit: req.body.limit }),
      res,
      next,
      'Task comments retrieved successfully'
    );

  uploadTaskAttachment = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.uploadAttachment({
        ...identity(req),
        taskId: Number(req.body.taskId),
        taskCommentId: req.body.taskCommentId === undefined ? undefined : Number(req.body.taskCommentId),
        remarks: req.body.remarks,
        file: req.file,
      }),
      res,
      next,
      'Task attachment uploaded successfully'
    );

  getTaskAttachments = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.listAttachments({ ...identity(req), taskId: req.body.taskId, page: req.body.page, limit: req.body.limit }),
      res,
      next,
      'Task attachments retrieved successfully'
    );

  getTaskAttachment = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.getAttachment({ ...identity(req), taskId: req.body.taskId, attachmentId: req.body.attachmentId }),
      res,
      next,
      'Task attachment retrieved successfully'
    );
}

export default new TaskController();