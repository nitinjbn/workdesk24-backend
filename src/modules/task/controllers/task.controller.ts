import { NextFunction, Response } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
import taskService from '../services/task.service';
import { mediaDownloadError } from '../../../shared/utils/media-storage.util';

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

  createTaskWithAttachment = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.createTaskWithAttachment({
        ...identity(req),
        title: req.body.title,
        description: req.body.description,
        assignedToUserId: Number(req.body.assignedToUserId),
        customerId: req.body.customerId === undefined ? undefined : Number(req.body.customerId),
        visitId: req.body.visitId === undefined ? undefined : Number(req.body.visitId),
        priority: req.body.priority,
        dueAt: req.body.dueAt === undefined ? undefined : Number(req.body.dueAt),
        remarks: req.body.remarks,
        file: req.file,
      }),
      res,
      next,
      'Task created with attachment successfully'
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

  addTaskCommentWithAttachment = (req: AuthRequest, res: Response, next: NextFunction): Promise<void> =>
    this.respond(
      () => taskService.addTaskCommentWithAttachment({
        ...identity(req),
        taskId: Number(req.body.taskId),
        comment: req.body.comment,
        remarks: req.body.remarks,
        file: req.file,
      }),
      res,
      next,
      'Task comment added with attachment successfully'
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

  downloadAttachment = async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    const abort = new AbortController();
    const disconnect = (): void => abort.abort();
    req.once('aborted', disconnect);
    res.once('close', disconnect);
    const cleanup = (): void => {
      req.off('aborted', disconnect);
      res.off('close', disconnect);
    };
    try {
      const { stream, fileName, fileType, extension } = await taskService.downloadAttachment({
        ...identity(req), attachmentId: req.body?.attachmentId,
      }, abort.signal);
      if (abort.signal.aborted || res.destroyed) {
        stream.destroy();
        cleanup();
        return;
      }
      let name = Array.from(fileName, (character) => {
        const code = character.charCodeAt(0);
        return code < 32 || code === 127 ? '_' : character;
      }).join('').replace(/[\\/"'<>:|?*]/g, '_').replace(/^\.+/, '').trim();
      const suffix = name.match(/\.(pdf|png|jpe?g|webp)$/i)?.[0];
      if (suffix && (suffix.slice(1).toLowerCase() === extension || (extension === 'jpg' && suffix.toLowerCase() === '.jpeg'))) {
        name = `${name.slice(0, -suffix.length).slice(0, 200) || 'attachment'}${suffix}`;
      } else {
        name = `${name.slice(0, 200) || 'attachment'}.${extension}`;
      }
      res.attachment(name);
      res.setHeader('Content-Type', fileType);
      res.setHeader('Cache-Control', 'private, no-store');
      res.setHeader('X-Content-Type-Options', 'nosniff');
      const length = stream.headers['content-length'];
      if (typeof length === 'string' && /^\d+$/.test(length) && Number.isSafeInteger(Number(length))) {
        res.setHeader('Content-Length', length);
      }
      let failed = false;
      const fail = (error?: Error & { statusCode?: number }): void => {
        if (failed) return;
        failed = true;
        stream.unpipe(res);
        cleanup();
        abort.abort();
        if (res.destroyed) return;
        if (res.headersSent) {
          res.destroy();
          return;
        }
        for (const header of ['Content-Disposition', 'Content-Type', 'Content-Length']) res.removeHeader(header);
        next(mediaDownloadError(error?.statusCode === 504));
      };
      stream.once('error', fail);
      stream.once('close', () => {
        if (!stream.complete) fail();
      });
      res.once('error', () => {
        abort.abort();
        cleanup();
      });
      res.once('finish', cleanup);
      stream.pipe(res);
    } catch (error) {
      cleanup();
      abort.abort();
      if (!res.destroyed && !res.headersSent) next(error);
      else if (!res.destroyed) res.destroy();
    }
  };
}

export default new TaskController();