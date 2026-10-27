import { Op, QueryTypes, Transaction } from 'sequelize';
import { Customer, sequelize, Task, TaskAttachments, TaskComments, TaskLogs, TaskSettings, User, Visit } from '../../../models';
import { CONFIG } from '../../../config/constants';

interface TaskDashboardUserRow {
  userId: number | string;
  name: string | null;
  profileImageUrl: string | null;
  assignedCount: number | string;
  pendingCount: number | string;
  inProgressCount: number | string;
  completedCount: number | string;
  overdueCount: number | string;
  highCount: number | string;
  mediumCount: number | string;
  lowCount: number | string;
  urgentCount: number | string;
}

interface TaskListScope {
  hostId: number;
  userId: number;
  isAdmin: boolean;
  filters: Record<string, unknown>;
  sortBy: string;
  sortOrder: 'ASC' | 'DESC';
  now: number;
}

export class TaskRepository {
  async getDashboardStats(hostId: number, now: number) {
    const rows = await sequelize.query<TaskDashboardUserRow>(
      `SELECT t.assignedToUserId AS userId, u.name, u.profileImageUrl,
              COUNT(*) AS assignedCount,
              SUM(CASE WHEN t.status = 'PENDING' AND (t.dueAt IS NULL OR t.dueAt >= :now) THEN 1 ELSE 0 END) AS pendingCount,
              SUM(CASE WHEN t.status = 'IN_PROGRESS' AND (t.dueAt IS NULL OR t.dueAt >= :now) THEN 1 ELSE 0 END) AS inProgressCount,
              SUM(CASE WHEN t.status = 'COMPLETED' THEN 1 ELSE 0 END) AS completedCount,
              SUM(CASE WHEN t.status IN ('PENDING', 'IN_PROGRESS') AND t.dueAt < :now THEN 1 ELSE 0 END) AS overdueCount,
              SUM(CASE WHEN t.priority = 'HIGH' THEN 1 ELSE 0 END) AS highCount,
              SUM(CASE WHEN t.priority = 'MEDIUM' THEN 1 ELSE 0 END) AS mediumCount,
              SUM(CASE WHEN t.priority = 'LOW' THEN 1 ELSE 0 END) AS lowCount,
              SUM(CASE WHEN t.priority = 'URGENT' THEN 1 ELSE 0 END) AS urgentCount
       FROM wd_tasks t
       LEFT JOIN wd_users u ON u.id = t.assignedToUserId AND u.hostId = t.hostId AND u.isDeleted = 0
       WHERE t.hostId = :hostId AND t.isDeleted = 0 AND t.status <> 'CANCELLED'
       GROUP BY t.assignedToUserId, u.name, u.profileImageUrl
       ORDER BY assignedCount DESC, t.assignedToUserId ASC`,
      { replacements: { hostId, now }, type: QueryTypes.SELECT }
    );
    return rows.map((row) => ({
      userId: Number(row.userId),
      name: row.name,
      profileImageUrl: row.profileImageUrl,
      assignedCount: Number(row.assignedCount),
      pendingCount: Number(row.pendingCount),
      inProgressCount: Number(row.inProgressCount),
      completedCount: Number(row.completedCount),
      overdueCount: Number(row.overdueCount),
      highCount: Number(row.highCount),
      mediumCount: Number(row.mediumCount),
      lowCount: Number(row.lowCount),
      urgentCount: Number(row.urgentCount),
    }));
  }

  async lockTaskSettings(hostId: number, now: number, transaction: Transaction): Promise<InstanceType<typeof TaskSettings> | null> {
    // The unique hostId key serializes initialization, without a missing-row gap lock
    // or overwriting an existing host's prefix, counter, or timestamps.
    await sequelize.query(
      `INSERT INTO wd_task_settings (hostId, taskNumberPrefix, nextTaskNumber, createdAt, updatedAt)
       VALUES (:hostId, :prefix, :nextTaskNumber, :now, :now)
       ON DUPLICATE KEY UPDATE hostId = wd_task_settings.hostId`,
      {
        replacements: {
          hostId,
          prefix: CONFIG.TASK_SETTINGS.DEFAULT_TASK_NUMBER_PREFIX,
          nextTaskNumber: CONFIG.TASK_SETTINGS.DEFAULT_NEXT_TASK_NUMBER,
          now,
        },
        transaction,
      }
    );
    return TaskSettings.findOne({
      where: { hostId },
      transaction,
      lock: transaction.LOCK.UPDATE,
    });
  }

  advanceTaskNumber(settings: InstanceType<typeof TaskSettings>, nextTaskNumber: string, now: number, transaction: Transaction): Promise<InstanceType<typeof TaskSettings>> {
    return settings.update({ nextTaskNumber, updatedAt: now }, { transaction });
  }

  async getTask(hostId: number, taskId: number, transaction?: Transaction, lock = false): Promise<any> {
    return Task.findOne({
      where: { hostId, id: taskId, isDeleted: 0 },
      include: lock ? [] : [
        {
          model: User,
          as: 'assignedToUser',
          required: false,
          where: { hostId, isDeleted: 0 },
          attributes: ['id', 'name', 'email', 'profileImageUrl'],
        },
        {
          model: User,
          as: 'createdByUser',
          required: false,
          where: { hostId, isDeleted: 0 },
          attributes: ['id', 'name', 'email'],
        },
        {
          model: Customer,
          as: 'customer',
          required: false,
          where: { hostId, isDeleted: 0 },
          attributes: ['id', 'customerName', 'customerCode'],
        },
        {
          model: Visit,
          as: 'visit',
          required: false,
          where: { hostId, isDeleted: 0 },
          attributes: ['id', 'customerId', 'customerName', 'checkInTime'],
        },
      ],
      transaction,
      lock: lock && transaction ? transaction.LOCK.UPDATE : undefined,
    } as any);
  }

  private taskListOptions(params: TaskListScope) {
    const { hostId, userId, isAdmin, filters, sortBy, sortOrder, now } = params;
    const where: Record<string | symbol, unknown> = { hostId, isDeleted: 0 };

    if (!isAdmin) where.assignedToUserId = userId;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedToUserId !== undefined && isAdmin) {
      if (Array.isArray(filters.assignedToUserId)) {
        if (filters.assignedToUserId.length > 0) where.assignedToUserId = { [Op.in]: filters.assignedToUserId };
      } else {
        where.assignedToUserId = filters.assignedToUserId;
      }
    }
    if (filters.createdByUserId !== undefined) where.createdByUserId = filters.createdByUserId;
    if (filters.customerId !== undefined) where.customerId = filters.customerId;
    if (filters.visitId !== undefined) where.visitId = filters.visitId;
    if (filters.dueFrom !== undefined || filters.dueTo !== undefined) {
      where.dueAt = {};
      if (filters.dueFrom !== undefined) where.dueAt[Op.gte] = filters.dueFrom;
      if (filters.dueTo !== undefined) where.dueAt[Op.lte] = filters.dueTo;
    }
    if (filters.completedFrom !== undefined || filters.completedTo !== undefined) {
      where.completedAt = {};
      if (filters.completedFrom !== undefined) where.completedAt[Op.gte] = filters.completedFrom;
      if (filters.completedTo !== undefined) where.completedAt[Op.lte] = filters.completedTo;
    }
    if (filters.overdueOnly) {
      where[Op.and] = [
        { dueAt: { [Op.lt]: now } },
        { status: { [Op.notIn]: ['COMPLETED', 'CANCELLED'] } },
      ];
    }
    if (typeof filters.search === 'string' && filters.search.trim()) {
      const search = `%${filters.search.trim()}%`;
      where[Op.or] = [
        { title: { [Op.like]: search } },
        { taskNumber: { [Op.like]: search } },
      ];
    }

    return {
      where,
      include: [
        { model: User, as: 'assignedToUser', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] },
        { model: User, as: 'createdByUser', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] },
      ],
      order: [[sortBy, sortOrder], ['id', 'ASC']] as [string, string][],
    };
  }

  async listTasks(params: TaskListScope & { page: number; limit: number }): Promise<{ rows: any[]; count: number }> {
    return Task.findAndCountAll({
      ...this.taskListOptions(params),
      limit: params.limit,
      offset: (params.page - 1) * params.limit,
      distinct: true,
    });
  }

  async getKanbanTasks(params: TaskListScope) {
    const options = this.taskListOptions(params);
    return Task.findAll({
      ...options,
      where: { [Op.and]: [options.where, { status: { [Op.ne]: 'CANCELLED' } }] },
    });
  }

  async findUser(hostId: number, userId: number, transaction?: Transaction): Promise<any> {
    return User.findOne({
      where: { hostId, id: userId, isDeleted: 0 },
      attributes: ['id', 'hostId', 'name', 'email', 'isFieldAppUser', 'isAdminUser', 'accountStatus'],
      transaction,
    } as any);
  }

  async findCustomer(hostId: number, customerId: number, transaction?: Transaction): Promise<any> {
    return Customer.findOne({ where: { hostId, id: customerId, isDeleted: 0 }, transaction } as any);
  }

  async findVisit(hostId: number, visitId: number, transaction?: Transaction): Promise<any> {
    return Visit.findOne({ where: { hostId, id: visitId, isDeleted: 0 }, transaction } as any);
  }

  createTask(data: Record<string, unknown>, transaction: Transaction): Promise<any> {
    return Task.create(data as any, { transaction });
  }

  updateTask(task: any, data: Record<string, unknown>, transaction: Transaction): Promise<any> {
    return task.update(data, { transaction });
  }

  createLog(data: Record<string, unknown>, transaction: Transaction): Promise<any> {
    return TaskLogs.create(data as any, { transaction });
  }

  async getComments(hostId: number, taskId: number, limit: number, offset: number): Promise<{ rows: any[]; count: number }> {
    return TaskComments.findAndCountAll({
      where: { hostId, taskId },
      include: [{ model: User, as: 'user', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] }],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
    } as any);
  }

  createComment(data: Record<string, unknown>, transaction?: Transaction): Promise<any> {
    return TaskComments.create(data as any, { transaction });
  }

  async getLogs(hostId: number, taskId: number, limit: number, offset: number): Promise<{ rows: any[]; count: number }> {
    return TaskLogs.findAndCountAll({
      where: { hostId, taskId },
      include: [
        { model: User, as: 'performedByUser', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] },
        { model: User, as: 'oldAssignedToUser', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] },
        { model: User, as: 'newAssignedToUser', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
    } as any);
  }

  async getAttachments(hostId: number, taskId: number, limit: number, offset: number): Promise<{ rows: any[]; count: number }> {
    return TaskAttachments.findAndCountAll({
      where: { hostId, taskId },
      include: [
        { model: User, as: 'uploadedByUser', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] },
        { model: TaskComments, as: 'taskComment', required: false, where: { hostId, taskId }, attributes: ['id', 'userId', 'comment', 'createdAt'] },
      ],
      order: [['createdAt', 'DESC'], ['id', 'DESC']],
      limit,
      offset,
    } as any);
  }

  async getAttachment(hostId: number, taskId: number, attachmentId: number): Promise<any> {
    return TaskAttachments.findOne({ where: { hostId, taskId, id: attachmentId } } as any);
  }

  async getAttachmentById(hostId: number, attachmentId: number): Promise<InstanceType<typeof TaskAttachments> | null> {
    return TaskAttachments.findOne({ where: { hostId, id: attachmentId } });
  }

  createAttachment(data: Record<string, unknown>, transaction?: Transaction): Promise<any> {
    return TaskAttachments.create(data as any, { transaction });
  }

  async findComment(hostId: number, taskId: number, commentId: number): Promise<any> {
    return TaskComments.findOne({ where: { hostId, taskId, id: commentId } } as any);
  }

  async findAssignee(hostId: number, userId: number, transaction?: Transaction): Promise<any> {
    const user = await this.findUser(hostId, userId, transaction);
    if (
      !user ||
      Number(user.isFieldAppUser) !== 1 ||
      user.accountStatus !== 'ACTIVE'
    ) return null;
    return user;
  }

}

export default new TaskRepository();