import { Transaction } from 'sequelize';
import moment from 'moment-timezone';
import { sequelize } from '../../../models';
import { logger } from '../../../config/database';
import { createConfiguredError } from '../../../shared/utils/error.util';
import {
  deleteMediaFromStorage,
  MediaUploadResult,
  mediaDownloadError,
  openMediaDownload,
  uploadBufferToMediaStorage,
} from '../../../shared/utils/media-storage.util';
import taskRepository, { TaskRepository } from '../repositories/task.repository';
import taskNotificationService, { TaskNotificationService } from '../../notifications/task/taskNotificationService';
import { getTaskTransition, isValidTaskFile, isValidUnixTimestamp } from './task-rules.util';
import { getHostDateTimeSettings, HostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { DateTimeFormatUtil, formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';

type TaskStatus = 'PENDING' | 'IN_PROGRESS' | 'COMPLETED' | 'CANCELLED';
type TaskPriority = 'LOW' | 'MEDIUM' | 'HIGH' | 'URGENT';
type TaskAction = 'CREATED' | 'UPDATED' | 'ASSIGNED' | 'REASSIGNED' | 'STARTED' | 'COMPLETED' | 'CANCELLED';

interface CreateTaskPayload {
  hostId: number; userId: number; isAdmin: boolean; title: string; description?: string;
  assignedToUserId: number; customerId?: number | null; visitId?: number | null;
  priority?: TaskPriority; dueAt?: number | null;
}

interface TaskAttachmentPayload {
  hostId: number; taskId: number; userId: number; isAdmin: boolean; taskCommentId?: number;
  remarks?: string; file?: Express.Multer.File;
}

interface TaskCommentPayload {
  hostId: number; taskId: number; userId: number; isAdmin: boolean; comment: string;
}

interface TaskListPayload {
  hostId: number; userId: number; isAdmin: boolean; filters?: Record<string, unknown>;
  page?: number; limit?: number; sortBy?: string; sortOrder?: string;
}

const SORT_FIELDS = ['id', 'title', 'priority', 'status', 'dueAt', 'createdAt', 'updatedAt'];
const TASK_STATUSES: TaskStatus[] = ['PENDING', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'];
const TASK_PRIORITIES: TaskPriority[] = ['LOW', 'MEDIUM', 'HIGH', 'URGENT'];
const MAX_PAGE_SIZE = 100;
const MAX_COMMENT_LENGTH = 5000;
const MAX_FILE_SIZE = 10 * 1024 * 1024;

function taskError(code: string, message: string, statusCode = 400): Error {
  return createConfiguredError(code, message, statusCode, code);
}

function formatTaskNumber(prefix: string, counter: number | string): { taskNumber: string; nextTaskNumber: string } {
  if (typeof prefix !== 'string' || !prefix.trim() || prefix !== prefix.trim() || Array.from(prefix).length > 20) {
    throw taskError('INVALID_TASK_NUMBER_PREFIX', 'Task number prefix must contain 1-20 characters without surrounding whitespace', 500);
  }
  if (
    (typeof counter !== 'string' && typeof counter !== 'number') ||
    (typeof counter === 'number' && !Number.isSafeInteger(counter)) ||
    !/^[1-9]\d*$/.test(String(counter))
  ) {
    throw taskError('INVALID_TASK_NUMBER_COUNTER', 'Task number counter must be an exact positive integer', 500);
  }
  const number = BigInt(counter);
  if (number >= 9223372036854775807n) {
    throw taskError('TASK_NUMBER_OVERFLOW', 'Task number counter cannot be incremented within BIGINT range', 500);
  }
  const taskNumber = `${prefix}${prefix.endsWith('-') ? '' : '-'}${number}`;
  if (Array.from(taskNumber).length > 30) {
    throw taskError('TASK_NUMBER_OVERFLOW', 'Generated task number exceeds 30 characters', 500);
  }
  return { taskNumber, nextTaskNumber: String(number + 1n) };
}

function asPlain(value: any): any {
  return value && typeof value.toJSON === 'function' ? value.toJSON() : value;
}

function validId(value: unknown): value is number {
  return Number.isSafeInteger(Number(value)) && Number(value) > 0;
}

function validateTimestamp(value: unknown, fieldName: string): number | null {
  if (value === null) return null;
  if (!isValidUnixTimestamp(value)) {
    throw taskError('INVALID_TASK_TIMESTAMP', `${fieldName} must be a positive Unix timestamp`);
  }
  return Number(value);
}

function getMimeExtension(mimeType: string): string | null {
  const supported: Record<string, string> = {
    'image/jpeg': 'jpg',
    'image/png': 'png',
    'image/webp': 'webp',
    'application/pdf': 'pdf',
  };
  return supported[mimeType.toLowerCase()] || null;
}

export class TaskService {
  constructor(
    private readonly repository: TaskRepository = taskRepository,
    private readonly transactionFactory: () => Promise<Transaction> = () => sequelize.transaction(),
    private readonly taskNotifications: Pick<
      TaskNotificationService,
      'notifyTaskCreated' | 'notifyTaskReassigned'
    > = taskNotificationService
  ) {}

  private async inTransaction<T>(callback: (transaction: Transaction) => Promise<T>): Promise<T> {
    const transaction = await this.transactionFactory();
    try {
      const result = await callback(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private requireAdmin(isAdmin: boolean): void {
    if (!isAdmin) throw taskError('TASK_ADMIN_REQUIRED', 'Admin access is required for this operation', 403);
  }

  async getDashboardStats(payload: { hostId: number; isAdmin: boolean }) {
    this.requireAdmin(payload.isAdmin);
    const now = Math.floor(Date.now() / 1000);
    const [users, settings] = await Promise.all([
      this.repository.getDashboardStats(payload.hostId, now),
      getHostDateTimeSettings(payload.hostId),
    ]);
    if (!moment.tz.zone(settings.timeZone)) {
      throw taskError('INVALID_TIME_ZONE', 'Host timezone must be a valid IANA timezone', 500);
    }
    const totals = users.reduce((result, user) => ({
      totalTasks: result.totalTasks + user.assignedCount,
      pending: result.pending + user.pendingCount,
      inProgress: result.inProgress + user.inProgressCount,
      completed: result.completed + user.completedCount,
      overdue: result.overdue + user.overdueCount,
      high: result.high + user.highCount,
      medium: result.medium + user.mediumCount,
      low: result.low + user.lowCount,
      urgent: result.urgent + user.urgentCount,
    }), { totalTasks: 0, pending: 0, inProgress: 0, completed: 0, overdue: 0, high: 0, medium: 0, low: 0, urgent: 0 });
    const percentage = (count: number): number =>
      totals.totalTasks === 0 ? 0 : Number((count / totals.totalTasks * 100).toFixed(2));

    return {
        timestamp: moment.unix(now).tz(settings.timeZone).format('YYYY-MM-DD hh:mm A'),
        summary: {
          totalTasks: totals.totalTasks,
          pendingTasks: totals.pending,
          inProgress: totals.inProgress,
          completed: totals.completed,
          overdue: totals.overdue,
          completionPercentage: percentage(totals.completed),
          pendingPercentage: percentage(totals.pending),
          inProgressPercentage: percentage(totals.inProgress),
          overduePercentage: percentage(totals.overdue),
        },
        statusDistribution: [
          { status: 'TODO', label: 'Pending', count: totals.pending, percentage: percentage(totals.pending), color: '#9333ea' },
          { status: 'IN_PROGRESS', label: 'In Progress', count: totals.inProgress, percentage: percentage(totals.inProgress), color: '#ffaa00' },
          { status: 'COMPLETED', label: 'Completed', count: totals.completed, percentage: percentage(totals.completed), color: '#008000' },

        ],
        priorityDistribution: [
          { priority: 'HIGH', label: 'High', count: totals.high, color: '#c00404' },
          { priority: 'MEDIUM', label: 'Medium', count: totals.medium, color: '#ffaa00' },
          { priority: 'LOW', label: 'Low', count: totals.low, color: '#0284c7' },
          { priority: 'URGENT', label: 'Urgent', count: totals.urgent, color: '#8b0000' },
        ],
        userTasksMetrics: users.map((user) => ({
          userId: user.userId,
          name: user.name,
          profileImageUrl: user.profileImageUrl,
          assignedCount: user.assignedCount,
          completedCount: user.completedCount,
          overdueCount: user.overdueCount,
          efficiencyRate: user.assignedCount === 0
            ? 0 : Number((user.completedCount / user.assignedCount * 100).toFixed(1)),
        }))
    };
  }

  private async getVisibleTask(hostId: number, taskId: number, userId: number, isAdmin: boolean): Promise<any> {
    if (!validId(taskId)) throw taskError('INVALID_TASK_ID', 'A valid taskId is required');
    const task = await this.repository.getTask(hostId, taskId);
    if (!task || (!isAdmin && Number(task.assignedToUserId) !== Number(userId))) {
      throw taskError('TASK_NOT_FOUND', 'Task not found', 404);
    }
    return task;
  }

  private async validateReferences(
    hostId: number,
    customerId: number | null | undefined,
    visitId: number | null | undefined,
    transaction?: Transaction
  ): Promise<{ customerId: number | null; visitId: number | null }> {
    let resolvedCustomerId = customerId == null ? null : Number(customerId);
    const resolvedVisitId = visitId == null ? null : Number(visitId);
    if (resolvedCustomerId !== null) {
      if (!validId(resolvedCustomerId) || !(await this.repository.findCustomer(hostId, resolvedCustomerId, transaction))) {
        throw taskError('TASK_CUSTOMER_NOT_FOUND', 'Customer not found', 404);
      }
    }
    if (resolvedVisitId !== null) {
      if (!validId(resolvedVisitId)) throw taskError('INVALID_VISIT_ID', 'visitId must be a valid ID');
      const visit = await this.repository.findVisit(hostId, resolvedVisitId, transaction);
      if (!visit) throw taskError('TASK_VISIT_NOT_FOUND', 'Visit not found', 404);
      const visitCustomerId = Number(visit.customerId);
      if (resolvedCustomerId === null) resolvedCustomerId = visitCustomerId;
      else if (resolvedCustomerId !== visitCustomerId) {
        throw taskError('TASK_VISIT_CUSTOMER_MISMATCH', 'The visit does not belong to the selected customer');
      }
    }
    return { customerId: resolvedCustomerId, visitId: resolvedVisitId };
  }

  async createTask(payload: CreateTaskPayload): Promise<any> {
    return this.createTaskInternal(payload);
  }

  async createTaskWithAttachment(payload: CreateTaskPayload & {
    remarks?: string; file?: Express.Multer.File;
  }): Promise<any> {
    this.requireAdmin(payload.isAdmin);
    const attachmentPayload = {
      hostId: payload.hostId, userId: payload.userId, isAdmin: payload.isAdmin,
      taskId: 0, remarks: payload.remarks, file: payload.file,
    };
    const file = payload.file ? this.validateAttachment(attachmentPayload) : undefined;
    return this.createTaskInternal(payload, file ? { ...attachmentPayload, file } : undefined);
  }

  private async createTaskInternal(
    payload: CreateTaskPayload,
    attachmentPayload?: TaskAttachmentPayload & { file: Express.Multer.File }
  ): Promise<any> {
    this.requireAdmin(payload.isAdmin);
    const title = typeof payload.title === 'string' ? payload.title.trim() : '';
    if (!title || title.length > 100) throw taskError('INVALID_TASK_TITLE', 'title must contain 1-100 characters');
    if (payload.description !== undefined && (typeof payload.description !== 'string' || payload.description.length > 500)) {
      throw taskError('INVALID_TASK_DESCRIPTION', 'description must not exceed 500 characters');
    }
    if (!validId(payload.assignedToUserId)) throw taskError('INVALID_ASSIGNEE_ID', 'assignedToUserId is required');
    if (payload.priority !== undefined && !TASK_PRIORITIES.includes(payload.priority)) {
      throw taskError('INVALID_TASK_PRIORITY', 'priority must be LOW, MEDIUM, HIGH, or URGENT');
    }
    const dueAt = payload.dueAt === undefined ? null : validateTimestamp(payload.dueAt, 'dueAt');
    let uploaded: MediaUploadResult | undefined;
    const result = await this.inTransaction(async (transaction) => {
      const assignee = await this.repository.findAssignee(payload.hostId, payload.assignedToUserId, transaction);
      if (!assignee) throw taskError('INVALID_TASK_ASSIGNEE', 'Assigned user is not eligible for task assignment', 404);
      const refs = await this.validateReferences(payload.hostId, payload.customerId, payload.visitId, transaction);
      if (attachmentPayload) {
        uploaded = await uploadBufferToMediaStorage(attachmentPayload.file, `${payload.hostId}/tasks`, { accessMode: 'authenticated' });
      }
      const now = Math.floor(Date.now() / 1000);
      const settings = await this.repository.lockTaskSettings(payload.hostId, now, transaction);
      if (!settings) throw taskError('TASK_SETTINGS_NOT_FOUND', 'Task settings could not be initialized', 500);
      const { taskNumber, nextTaskNumber } = formatTaskNumber(settings.taskNumberPrefix, settings.nextTaskNumber);
      const task = await this.repository.createTask({
        hostId: payload.hostId,
        taskNumber,
        title,
        description: payload.description?.trim() || null,
        assignedToUserId: payload.assignedToUserId,
        createdByUserId: payload.userId,
        customerId: refs.customerId,
        visitId: refs.visitId,
        priority: payload.priority || 'LOW',
        status: 'PENDING',
        dueAt,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
      }, transaction);
      await this.repository.createLog({
        hostId: payload.hostId,
        taskId: task.id,
        action: 'CREATED',
        performedByUserId: payload.userId,
        oldStatus: null,
        newStatus: 'PENDING',
        oldAssignedToUserId: null,
        newAssignedToUserId: payload.assignedToUserId,
        createdAt: now,
      }, transaction);
      await this.repository.advanceTaskNumber(settings, nextTaskNumber, now, transaction);
      if (attachmentPayload && uploaded) {
        const attachment = await this.persistAttachment({ ...attachmentPayload, taskId: task.id }, uploaded, transaction);
        return { task: asPlain(task), attachment: asPlain(attachment) };
      }
      return { task: asPlain(task) };
    }).catch(async (error: unknown) => {
      if (uploaded) await this.cleanupAttachment(uploaded);
      throw error;
    });

    if (result.task.assignedToUserId) {
      try {
        await this.taskNotifications.notifyTaskCreated(result.task);
      } catch (_error) {
        logger.error('Failed to trigger task-created notification', {
          hostId: result.task.hostId,
          taskId: result.task.id,
          recipientUserId: result.task.assignedToUserId,
        });
      }
    }
    return result;
  }

  private validateTaskFilters(filters: Record<string, unknown>) {
    if (!filters || typeof filters !== 'object' || Array.isArray(filters)) {
      throw taskError('INVALID_TASK_FILTER', 'filters must be an object');
    }
    if (filters.status !== undefined && !TASK_STATUSES.includes(filters.status as TaskStatus)) {
      throw taskError('INVALID_TASK_STATUS', 'status is invalid');
    }
    if (filters.priority !== undefined && !TASK_PRIORITIES.includes(filters.priority as TaskPriority)) {
      throw taskError('INVALID_TASK_PRIORITY', 'priority is invalid');
    }
    if (filters.assignedToUserId !== undefined) {
      const ids = Array.isArray(filters.assignedToUserId) ? filters.assignedToUserId : [filters.assignedToUserId];
      if (ids.some((id) => !['number', 'string'].includes(typeof id) || !validId(id))) {
        throw taskError('INVALID_TASK_FILTER', 'assignedToUserId must be a valid ID or an array of valid IDs');
      }
    }
    for (const key of ['createdByUserId', 'customerId', 'visitId'] as const) {
      if (filters[key] !== undefined && !validId(filters[key])) throw taskError('INVALID_TASK_FILTER', `${key} must be a valid ID`);
    }
    if (filters.dueDate !== undefined && (filters.dueFrom !== undefined || filters.dueTo !== undefined)) {
      throw taskError('INVALID_TASK_DUE_RANGE', 'Use either dueDate or dueFrom/dueTo, not both');
    }
    const dueFrom = filters.dueFrom === undefined ? undefined : validateTimestamp(filters.dueFrom, 'dueFrom');
    const dueTo = filters.dueTo === undefined ? undefined : validateTimestamp(filters.dueTo, 'dueTo');
    if (dueFrom === null || dueTo === null) throw taskError('INVALID_TASK_DUE_RANGE', 'Due date filters must be Unix timestamps');
    if (dueFrom !== undefined && dueTo !== undefined && Number(dueFrom) > Number(dueTo)) {
      throw taskError('INVALID_TASK_DUE_RANGE', 'dueFrom must be less than or equal to dueTo');
    }
    if (filters.overdueOnly !== undefined && ![true, false, 0, 1].includes(filters.overdueOnly as any)) {
      throw taskError('INVALID_OVERDUE_FILTER', 'overdueOnly must be a boolean or 0/1');
    }
    if (filters.search !== undefined && (typeof filters.search !== 'string' || filters.search.length > 100)) {
      throw taskError('INVALID_TASK_SEARCH', 'search must be a string of at most 100 characters');
    }
    return { dueFrom, dueTo };
  }

  private normalizeTaskFilters(
    filters: Record<string, unknown>,
    bounds: { dueFrom?: number; dueTo?: number },
    settings: HostDateTimeSettings
  ): Record<string, unknown> {
    let { dueFrom, dueTo } = bounds;
    if (filters.dueDate !== undefined) {
      const range = DateTimeFormatUtil.getUnixDayRange(filters.dueDate, settings.timeZone);
      dueFrom = range.fromDate;
      dueTo = range.tillDate;
    }
    const completedRange = filters.completedDate === undefined
      ? undefined
      : DateTimeFormatUtil.getUnixDayRange(filters.completedDate, settings.timeZone);
    const normalizedFilters: Record<string, unknown> = {
      ...filters, dueFrom, dueTo,
      completedFrom: completedRange?.fromDate,
      completedTo: completedRange?.tillDate,
      overdueOnly: Boolean(filters.overdueOnly),
    };
    delete normalizedFilters.dueDate;
    delete normalizedFilters.completedDate;
    if (Array.isArray(filters.assignedToUserId)) {
      if (filters.assignedToUserId.length === 0) delete normalizedFilters.assignedToUserId;
      else normalizedFilters.assignedToUserId = [...new Set(filters.assignedToUserId.map(Number))];
    }
    return normalizedFilters;
  }

  async getKanbanBoard(payload: TaskListPayload) {
    this.requireAdmin(payload.isAdmin);
    const filters = payload.filters ?? {};
    const bounds = this.validateTaskFilters(filters);
    const sortBy = payload.sortBy || 'createdAt';
    const sortOrder = String(payload.sortOrder || 'DESC').toUpperCase();
    if (!SORT_FIELDS.includes(sortBy) || !['ASC', 'DESC'].includes(sortOrder)) {
      throw taskError('INVALID_TASK_SORT', 'sortBy or sortOrder is invalid');
    }
    const now = Math.floor(Date.now() / 1000);
    const settings = await getHostDateTimeSettings(payload.hostId);
    if (!moment.tz.zone(settings.timeZone)) {
      throw taskError('INVALID_TIME_ZONE', 'Host timezone must be a valid IANA timezone', 500);
    }
    const rows = await this.repository.getKanbanTasks({
      hostId: payload.hostId, userId: payload.userId, isAdmin: payload.isAdmin,
      filters: this.normalizeTaskFilters(filters, bounds, settings),
      sortBy, sortOrder: sortOrder as 'ASC' | 'DESC', now,
    });
    const columns = [
      { columnId: 'col_todo', title: 'Pending', statusKey: 'TODO' },
      { columnId: 'col_in_progress', title: 'In Progress', statusKey: 'IN_PROGRESS' },
      { columnId: 'col_completed', title: 'Completed', statusKey: 'COMPLETED' },
      { columnId: 'col_overdue', title: 'Overdue', statusKey: 'OVERDUE' },
    ].map((column) => ({ ...column, taskCount: 0, tasks: [] as Record<string, unknown>[] }));
    for (const row of rows) {
      const overdue = (row.status === 'PENDING' || row.status === 'IN_PROGRESS')
        && row.dueAt != null && Number(row.dueAt) < now;
      const key = overdue ? 'OVERDUE' : row.status === 'PENDING' ? 'TODO' : row.status;
      const column = columns.find((item) => item.statusKey === key);
      if (!column) throw taskError('INVALID_TASK_STATUS', 'Task has an unsupported Kanban status', 500);
      column.tasks.push(formatDateTimeFieldsBySettings({ ...row.toJSON() }, settings));
      column.taskCount += 1;
    }
    return {
      timestamp: moment.unix(now).tz(settings.timeZone).format('YYYY-MM-DD hh:mm A'),
      columns,
    };
  }

  async listTasks(payload: TaskListPayload): Promise<any> {
    const filters = payload.filters || {};
    const bounds = this.validateTaskFilters(filters);
    const page = payload.page === undefined ? 1 : Number(payload.page);
    const limit = payload.limit === undefined ? 20 : Number(payload.limit);
    const sortBy = payload.sortBy || 'createdAt';
    const sortOrder = String(payload.sortOrder || 'DESC').toUpperCase();
    if (!Number.isInteger(page) || page < 1 || !Number.isInteger(limit) || limit < 1 || limit > MAX_PAGE_SIZE) {
      throw taskError('INVALID_TASK_PAGINATION', `page must be positive and limit must be 1-${MAX_PAGE_SIZE}`);
    }
    if (!SORT_FIELDS.includes(sortBy) || !['ASC', 'DESC'].includes(sortOrder)) {
      throw taskError('INVALID_TASK_SORT', 'sortBy or sortOrder is invalid');
    }
    const dateTimeSettings = await getHostDateTimeSettings(payload.hostId);
    const normalizedFilters = this.normalizeTaskFilters(filters, bounds, dateTimeSettings);
    const result = await this.repository.listTasks({
      hostId: payload.hostId,
      userId: payload.userId,
      isAdmin: payload.isAdmin,
      filters: normalizedFilters,
      page,
      limit,
      sortBy,
      sortOrder: sortOrder as 'ASC' | 'DESC',
      now: Math.floor(Date.now() / 1000),
    });

    const plainData = result.rows.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      tasks: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) },
    };
  }

  async getTaskDetails(payload: { hostId: number; taskId: number; userId: number; isAdmin: boolean }): Promise<any> {
    const task = await this.getVisibleTask(payload.hostId, payload.taskId, payload.userId, payload.isAdmin);
    const [comments, attachments, logs] = await Promise.all([
      this.repository.getComments(payload.hostId, payload.taskId, 10, 0),
      this.repository.getAttachments(payload.hostId, payload.taskId, 10, 0),
      this.repository.getLogs(payload.hostId, payload.taskId, 10, 0),
    ]);

    const dateTimeSettings = await getHostDateTimeSettings(payload.hostId);
    const plainAttachments = attachments.rows.map(asPlain);
    const commentsWithAttachments = comments.rows.map((row) => {
      const comment = asPlain(row);
      return {
        ...comment,
        attachments: plainAttachments.filter((attachment: { taskCommentId?: number | null }) =>
          attachment.taskCommentId != null && Number(attachment.taskCommentId) === Number(comment.id)
        ),
      };
    });

    return {
      task: {
        ...formatDateTimeFieldsBySettings([asPlain(task)], dateTimeSettings)[0],
        comments: formatDateTimeFieldsBySettings(commentsWithAttachments, dateTimeSettings),
        attachments: formatDateTimeFieldsBySettings(plainAttachments, dateTimeSettings),
        activity: formatDateTimeFieldsBySettings(logs.rows.map(asPlain), dateTimeSettings),
      },
    };
  }

  async updateTask(payload: {
    hostId: number; taskId: number; userId: number; isAdmin: boolean;
    title?: string; description?: string | null; priority?: TaskPriority;
    dueAt?: number | null; customerId?: number | null; visitId?: number | null;
  }): Promise<any> {
    this.requireAdmin(payload.isAdmin);
    return this.inTransaction(async (transaction) => {
      const task = await this.repository.getTask(payload.hostId, payload.taskId, transaction, true);
      if (!task) throw taskError('TASK_NOT_FOUND', 'Task not found', 404);
      const changes: Record<string, unknown> = {};
      if (payload.title !== undefined) {
        if (typeof payload.title !== 'string') throw taskError('INVALID_TASK_TITLE', 'title must be a string');
        const value = payload.title.trim();
        if (!value || value.length > 100) throw taskError('INVALID_TASK_TITLE', 'title must contain 1-100 characters');
        changes.title = value;
      }
      if (payload.description !== undefined) {
        if (payload.description !== null && (typeof payload.description !== 'string' || payload.description.length > 500)) {
          throw taskError('INVALID_TASK_DESCRIPTION', 'description must not exceed 500 characters');
        }
        changes.description = payload.description?.trim() || null;
      }
      if (payload.priority !== undefined) {
        if (!TASK_PRIORITIES.includes(payload.priority)) throw taskError('INVALID_TASK_PRIORITY', 'priority is invalid');
        changes.priority = payload.priority;
      }
      if (payload.dueAt !== undefined) changes.dueAt = validateTimestamp(payload.dueAt, 'dueAt');
      const customerId = payload.customerId !== undefined ? payload.customerId : task.customerId;
      const visitId = payload.visitId !== undefined ? payload.visitId : task.visitId;
      if (payload.customerId !== undefined || payload.visitId !== undefined) {
        const refs = await this.validateReferences(payload.hostId, customerId, visitId, transaction);
        changes.customerId = refs.customerId;
        changes.visitId = refs.visitId;
      }
      const changed = Object.entries(changes).filter(([key, value]) => (task as any)[key] !== value);
      if (changed.length === 0) return { task: asPlain(task), changed: false };
      const now = Math.floor(Date.now() / 1000);
      const oldStatus = task.status as TaskStatus;
      await this.repository.updateTask(task, { ...Object.fromEntries(changed), updatedAt: now }, transaction);
      await this.repository.createLog({
        hostId: payload.hostId, taskId: payload.taskId, action: 'UPDATED', performedByUserId: payload.userId,
        oldStatus, newStatus: oldStatus, createdAt: now,
      }, transaction);
      return { task: asPlain(task), changed: true };
    });
  }

  async assignTask(payload: { hostId: number; taskId: number; userId: number; isAdmin: boolean; assignedToUserId: number }): Promise<any> {
    this.requireAdmin(payload.isAdmin);
    if (!validId(payload.assignedToUserId)) throw taskError('INVALID_ASSIGNEE_ID', 'assignedToUserId is required');
    const transactionResult = await this.inTransaction(async (transaction) => {
      const task = await this.repository.getTask(payload.hostId, payload.taskId, transaction, true);
      if (!task) throw taskError('TASK_NOT_FOUND', 'Task not found', 404);
      const assignee = await this.repository.findAssignee(payload.hostId, payload.assignedToUserId, transaction);
      if (!assignee) throw taskError('INVALID_TASK_ASSIGNEE', 'Assigned user is not eligible for task assignment', 404);
      if (Number(task.assignedToUserId) === Number(payload.assignedToUserId)) {
        return { result: { task: asPlain(task), changed: false }, oldAssigneeId: null };
      }
      const oldAssigneeId = validId(task.assignedToUserId) ? Number(task.assignedToUserId) : null;
      const now = Math.floor(Date.now() / 1000);
      await this.repository.updateTask(task, { assignedToUserId: payload.assignedToUserId, updatedAt: now }, transaction);
      await this.repository.createLog({
        hostId: payload.hostId, taskId: payload.taskId,
        action: oldAssigneeId ? 'REASSIGNED' : 'ASSIGNED', performedByUserId: payload.userId,
        oldStatus: task.status, newStatus: task.status, oldAssignedToUserId: oldAssigneeId,
        newAssignedToUserId: payload.assignedToUserId, createdAt: now,
      }, transaction);
      return { result: { task: asPlain(task), changed: true }, oldAssigneeId };
    });

    if (transactionResult.result.changed) {
      try {
        await this.taskNotifications.notifyTaskReassigned(
          transactionResult.result.task,
          transactionResult.oldAssigneeId,
          Number(transactionResult.result.task.assignedToUserId)
        );
      } catch (_error) {
        logger.error('Failed to trigger task-reassignment notification', {
          hostId: transactionResult.result.task.hostId,
          taskId: transactionResult.result.task.id,
          oldAssigneeId: transactionResult.oldAssigneeId,
          newAssigneeId: transactionResult.result.task.assignedToUserId,
        });
      }
    }
    return transactionResult.result;
  }

  private async transition(payload: {
    hostId: number; taskId: number; userId: number; isAdmin: boolean;
    targetStatus: TaskStatus; action: TaskAction; remarks?: string;
  }): Promise<any> {
    return this.inTransaction(async (transaction) => {
      const task = await this.repository.getTask(payload.hostId, payload.taskId, transaction, true);
      if (!task) throw taskError('TASK_NOT_FOUND', 'Task not found', 404);
      if (!payload.isAdmin && Number(task.assignedToUserId) !== Number(payload.userId)) {
        throw taskError('TASK_NOT_ASSIGNED_TO_USER', 'Task not found', 404);
      }
      const currentStatus = task.status as TaskStatus;
      if (currentStatus === payload.targetStatus) {
        if (payload.action === 'CANCELLED') {
          throw taskError('INVALID_TASK_STATUS_TRANSITION', 'Task is already cancelled', 409);
        }
        return { task: asPlain(task), changed: false };
      }
      const allowed: Record<TaskAction, TaskStatus[]> = {
        CREATED: [], UPDATED: [], ASSIGNED: [], REASSIGNED: [],
        STARTED: ['PENDING'], COMPLETED: ['IN_PROGRESS'], CANCELLED: ['PENDING', 'IN_PROGRESS'],
      };
      const transition = getTaskTransition(currentStatus, payload.targetStatus);
      if (!allowed[payload.action].includes(currentStatus) || !transition || transition.action !== payload.action) {
        throw taskError('INVALID_TASK_STATUS_TRANSITION', `Cannot ${payload.action.toLowerCase()} a task in ${currentStatus} status`, 409);
      }
      if (payload.remarks !== undefined && payload.remarks !== null) {
        if (typeof payload.remarks !== 'string') throw taskError('INVALID_TASK_REMARKS', 'remarks must be a string');
        if (payload.remarks.length > 500) throw taskError('INVALID_TASK_REMARKS', 'remarks must not exceed 500 characters');
      }
      const now = Math.floor(Date.now() / 1000);
      const timestamps: Record<string, number> = { updatedAt: now };
      timestamps[transition.timestampField] = now;
      await this.repository.updateTask(task, { status: payload.targetStatus, ...timestamps }, transaction);
      await this.repository.createLog({
        hostId: payload.hostId, taskId: payload.taskId, action: payload.action,
        performedByUserId: payload.userId, oldStatus: currentStatus, newStatus: payload.targetStatus,
        remarks: payload.remarks?.trim() || null, createdAt: now,
      }, transaction);
      return { task: asPlain(task), changed: true };
    });
  }

  startTask(payload: { hostId: number; taskId: number; userId: number; isAdmin: boolean }): Promise<any> {
    return this.transition({ ...payload, targetStatus: 'IN_PROGRESS', action: 'STARTED' });
  }

  completeTask(payload: { hostId: number; taskId: number; userId: number; isAdmin: boolean; remarks?: string }): Promise<any> {
    return this.transition({ ...payload, targetStatus: 'COMPLETED', action: 'COMPLETED' });
  }

  cancelTask(payload: { hostId: number; taskId: number; userId: number; isAdmin: boolean; remarks?: string }): Promise<any> {
    return this.transition({ ...payload, targetStatus: 'CANCELLED', action: 'CANCELLED' });
  }

  private normalizePage(page?: number, limit?: number): { page: number; limit: number; offset: number } {
    const resolvedPage = page === undefined ? 1 : Number(page);
    const resolvedLimit = limit === undefined ? 20 : Number(limit);
    if (!Number.isInteger(resolvedPage) || resolvedPage < 1 || !Number.isInteger(resolvedLimit) || resolvedLimit < 1 || resolvedLimit > MAX_PAGE_SIZE) {
      throw taskError('INVALID_TASK_PAGINATION', `page must be positive and limit must be 1-${MAX_PAGE_SIZE}`);
    }
    return { page: resolvedPage, limit: resolvedLimit, offset: (resolvedPage - 1) * resolvedLimit };
  }

  async addComment(payload: TaskCommentPayload): Promise<any> {
    return this.addCommentInternal(payload);
  }

  async addTaskCommentWithAttachment(payload: TaskCommentPayload & { remarks?: string; file?: Express.Multer.File }): Promise<any> {
    const attachmentPayload = {
      hostId: payload.hostId, taskId: payload.taskId, userId: payload.userId,
      isAdmin: payload.isAdmin, remarks: payload.remarks, file: payload.file,
    };
    const file = payload.file ? this.validateAttachment(attachmentPayload) : undefined;
    return this.addCommentInternal(payload, file ? { ...attachmentPayload, file } : undefined);
  }

  private async addCommentInternal(
    payload: TaskCommentPayload,
    attachmentPayload?: TaskAttachmentPayload & { file: Express.Multer.File }
  ): Promise<any> {
    await this.getVisibleTask(payload.hostId, payload.taskId, payload.userId, payload.isAdmin);
    const comment = typeof payload.comment === 'string' ? payload.comment.trim() : '';
    if (!comment || comment.length > MAX_COMMENT_LENGTH) throw taskError('INVALID_TASK_COMMENT', `comment must contain 1-${MAX_COMMENT_LENGTH} characters`);
    const commentData = { hostId: payload.hostId, taskId: payload.taskId, userId: payload.userId, comment, createdAt: Math.floor(Date.now() / 1000) };
    if (!attachmentPayload) {
      const created = await this.repository.createComment(commentData);
      return { comment: asPlain(created) };
    }
    let uploaded: MediaUploadResult | undefined;
    try {
      return await this.inTransaction(async (transaction) => {
        uploaded = await uploadBufferToMediaStorage(attachmentPayload.file, `${payload.hostId}/tasks`, { accessMode: 'authenticated' });
        const created = await this.repository.createComment(commentData, transaction);
        const attachment = await this.persistAttachment({ ...attachmentPayload, taskCommentId: created.id }, uploaded, transaction);
        return { comment: asPlain(created), attachment: asPlain(attachment) };
      });
    } catch (error) {
      if (uploaded) await this.cleanupAttachment(uploaded);
      throw error;
    }
  }

  async listComments(payload: { hostId: number; taskId: number; userId: number; isAdmin: boolean; page?: number; limit?: number }): Promise<any> {
    await this.getVisibleTask(payload.hostId, payload.taskId, payload.userId, payload.isAdmin);
    const paging = this.normalizePage(payload.page, payload.limit);
    const result = await this.repository.getComments(payload.hostId, payload.taskId, paging.limit, paging.offset);
    return { comments: result.rows.map(asPlain), pagination: { page: paging.page, limit: paging.limit, total: result.count, totalPages: Math.ceil(result.count / paging.limit) } };
  }

  async listActivity(payload: { hostId: number; taskId: number; userId: number; isAdmin: boolean; page?: number; limit?: number }): Promise<any> {
    await this.getVisibleTask(payload.hostId, payload.taskId, payload.userId, payload.isAdmin);
    const paging = this.normalizePage(payload.page, payload.limit);
    const result = await this.repository.getLogs(payload.hostId, payload.taskId, paging.limit, paging.offset);
    return { activity: result.rows.map(asPlain), pagination: { page: paging.page, limit: paging.limit, total: result.count, totalPages: Math.ceil(result.count / paging.limit) } };
  }

  async listAttachments(payload: { hostId: number; taskId: number; userId: number; isAdmin: boolean; page?: number; limit?: number }): Promise<any> {
    await this.getVisibleTask(payload.hostId, payload.taskId, payload.userId, payload.isAdmin);
    const paging = this.normalizePage(payload.page, payload.limit);
    const result = await this.repository.getAttachments(payload.hostId, payload.taskId, paging.limit, paging.offset);
    return { attachments: result.rows.map(asPlain), pagination: { page: paging.page, limit: paging.limit, total: result.count, totalPages: Math.ceil(result.count / paging.limit) } };
  }

  async getAttachment(payload: { hostId: number; taskId: number; attachmentId: number; userId: number; isAdmin: boolean }): Promise<any> {
    await this.getVisibleTask(payload.hostId, payload.taskId, payload.userId, payload.isAdmin);
    if (!validId(payload.attachmentId)) throw taskError('INVALID_ATTACHMENT_ID', 'attachmentId is required');
    const attachment = await this.repository.getAttachment(payload.hostId, payload.taskId, payload.attachmentId);
    if (!attachment) throw taskError('TASK_ATTACHMENT_NOT_FOUND', 'Attachment not found', 404);
    return { attachment: asPlain(attachment) };
  }

  async getDownloadAttachment(payload: {
    hostId: number; userId: number; isAdmin: boolean; attachmentId: unknown;
  }): Promise<{ fileUrl: string; fileName: string; fileType: string; hostId: number }> {
    const value = payload.attachmentId;
    if (
      !['number', 'string'].includes(typeof value) ||
      (typeof value === 'string' && !/^\d+$/.test(value)) ||
      !validId(value)
    ) {
      throw taskError('INVALID_ATTACHMENT_ID', 'A valid positive integer attachmentId is required');
    }
    const attachment = await this.repository.getAttachmentById(payload.hostId, Number(value));
    if (!attachment) throw taskError('TASK_ATTACHMENT_NOT_FOUND', 'Attachment not found', 404);
    await this.getVisibleTask(payload.hostId, attachment.taskId, payload.userId, payload.isAdmin);
    if (
      attachment.taskCommentId != null &&
      !(await this.repository.findComment(payload.hostId, attachment.taskId, attachment.taskCommentId))
    ) {
      throw taskError('TASK_COMMENT_NOT_FOUND', 'Comment not found', 404);
    }
    return {
      fileUrl: attachment.fileUrl,
      fileName: attachment.fileName,
      fileType: attachment.fileType,
      hostId: payload.hostId,
    };
  }

  async downloadAttachment(payload: {
    hostId: number; userId: number; isAdmin: boolean; attachmentId: unknown;
  }, signal: AbortSignal) {
    const attachment = await this.getDownloadAttachment(payload);
    const extension = getMimeExtension(attachment.fileType);
    if (!extension) throw mediaDownloadError();
    const stream = await openMediaDownload(attachment.fileUrl, `${attachment.hostId}/tasks`, signal);
    if (stream.destroyed && !stream.complete) throw mediaDownloadError();
    const upstreamType = stream.headers['content-type']?.split(';')[0].trim().toLowerCase();
    if (upstreamType && upstreamType !== attachment.fileType.toLowerCase() && upstreamType !== 'application/octet-stream') {
      stream.destroy();
      throw mediaDownloadError();
    }
    return { stream, fileName: attachment.fileName, fileType: attachment.fileType.toLowerCase(), extension };
  }

  private validateAttachment(payload: TaskAttachmentPayload): Express.Multer.File {
    const file = payload.file;
    if (!file || !Buffer.isBuffer(file.buffer)) throw taskError('TASK_ATTACHMENT_REQUIRED', 'A file upload is required');
    if (!Number.isSafeInteger(file.size) || file.size <= 0 || file.size > MAX_FILE_SIZE) {
      throw taskError('TASK_ATTACHMENT_TOO_LARGE', 'Attachments must contain 1 byte to 10 MB');
    }
    const extension = getMimeExtension(file.mimetype);
    if (!extension || !isValidTaskFile(file.buffer, file.mimetype)) {
      throw taskError('INVALID_TASK_ATTACHMENT_TYPE', 'Only valid JPEG, PNG, WEBP, and PDF files are supported');
    }
    const originalExtension = file.originalname.split('.').pop()?.toLowerCase();
    const equivalentExtensions: Record<string, string[]> = { jpg: ['jpg', 'jpeg'], png: ['png'], webp: ['webp'], pdf: ['pdf'] };
    if (!originalExtension || !equivalentExtensions[extension].includes(originalExtension)) {
      throw taskError('INVALID_TASK_ATTACHMENT_EXTENSION', 'File extension does not match its content type');
    }
    if (payload.remarks !== undefined && payload.remarks !== null) {
      if (typeof payload.remarks !== 'string') throw taskError('INVALID_TASK_REMARKS', 'remarks must be a string');
      if (payload.remarks.length > 500) throw taskError('INVALID_TASK_REMARKS', 'remarks must not exceed 500 characters');
    }
    return file;
  }

  private persistAttachment(
    payload: TaskAttachmentPayload & { file: Express.Multer.File },
    uploaded: MediaUploadResult,
    transaction?: Transaction
  ): Promise<unknown> {
    const file = payload.file;
    const safeName = file.originalname.replace(/[\\/\u0000-\u001f]/g, '_').replace(/\.{2,}/g, '.').slice(0, 255);
    return this.repository.createAttachment({
      hostId: payload.hostId,
      taskId: payload.taskId,
      taskCommentId: payload.taskCommentId || null,
      uploadedByUserId: payload.userId,
      fileName: safeName,
      fileType: file.mimetype,
      fileSizeBytes: file.size,
      fileUrl: uploaded.url,
      remarks: typeof payload.remarks === 'string' ? payload.remarks.trim() || null : null,
      createdAt: Math.floor(Date.now() / 1000),
    }, transaction);
  }

  private async cleanupAttachment(uploaded: MediaUploadResult): Promise<void> {
    try {
      const resourceType = (uploaded.raw as { resource_type?: string } | undefined)?.resource_type;
      await deleteMediaFromStorage(uploaded.fileId, {
        resourceType: resourceType === 'video' || resourceType === 'raw' ? resourceType : 'image',
        accessMode: 'authenticated',
      });
    } catch (cleanupError) {
      logger.error('Failed to clean up task attachment after persistence failure', {
        fileId: uploaded.fileId,
        error: cleanupError instanceof Error ? cleanupError.message : String(cleanupError),
      });
    }
  }

  async uploadAttachment(payload: TaskAttachmentPayload): Promise<any> {
    await this.getVisibleTask(payload.hostId, payload.taskId, payload.userId, payload.isAdmin);
    const file = this.validateAttachment(payload);
    if (payload.taskCommentId !== undefined) {
      if (!validId(payload.taskCommentId) || !(await this.repository.findComment(payload.hostId, payload.taskId, payload.taskCommentId))) {
        throw taskError('TASK_COMMENT_NOT_FOUND', 'Comment not found', 404);
      }
    }
    const uploaded = await uploadBufferToMediaStorage(file, `${payload.hostId}/tasks`, { accessMode: 'authenticated' });
    try {
      const attachment = await this.persistAttachment({ ...payload, file }, uploaded);
      return { attachment: asPlain(attachment) };
    } catch (error) {
      await this.cleanupAttachment(uploaded);
      throw error;
    }
  }
}

export default new TaskService();