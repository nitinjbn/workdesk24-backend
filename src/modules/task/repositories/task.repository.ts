import { Op, Transaction } from 'sequelize';
import { Customer, Task, TaskAttachments, TaskComments, TaskLogs, User, Visit } from '../../../models';

export class TaskRepository {
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

  async listTasks(params: {
    hostId: number;
    userId: number;
    isAdmin: boolean;
    filters: Record<string, unknown>;
    page: number;
    limit: number;
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
    now: number;
  }): Promise<{ rows: any[]; count: number }> {
    const { hostId, userId, isAdmin, filters, page, limit, sortBy, sortOrder, now } = params;
    const where: any = { hostId, isDeleted: 0 };

    if (!isAdmin) where.assignedToUserId = userId;
    if (filters.status) where.status = filters.status;
    if (filters.priority) where.priority = filters.priority;
    if (filters.assignedToUserId !== undefined && isAdmin) {
      where.assignedToUserId = filters.assignedToUserId;
    }
    if (filters.createdByUserId !== undefined) where.createdByUserId = filters.createdByUserId;
    if (filters.customerId !== undefined) where.customerId = filters.customerId;
    if (filters.visitId !== undefined) where.visitId = filters.visitId;
    if (filters.dueFrom !== undefined || filters.dueTo !== undefined) {
      where.dueAt = {};
      if (filters.dueFrom !== undefined) where.dueAt[Op.gte] = filters.dueFrom;
      if (filters.dueTo !== undefined) where.dueAt[Op.lte] = filters.dueTo;
    }
    if (filters.overdueOnly) {
      where[Op.and] = [
        { dueAt: { [Op.lt]: now } },
        { status: { [Op.notIn]: ['COMPLETED', 'CANCELLED'] } },
      ];
    }
    if (typeof filters.search === 'string' && filters.search.trim()) {
      where.title = { [Op.like]: `%${filters.search.trim()}%` };
    }

    return Task.findAndCountAll({
      where,
      include: [
        { model: User, as: 'assignedToUser', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] },
        { model: User, as: 'createdByUser', required: false, where: { hostId, isDeleted: 0 }, attributes: ['id', 'name'] },
      ],
      order: [[sortBy, sortOrder], ['id', 'ASC']],
      limit,
      offset: (page - 1) * limit,
      distinct: true,
    } as any);
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

  createComment(data: Record<string, unknown>): Promise<any> {
    return TaskComments.create(data as any);
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

  createAttachment(data: Record<string, unknown>): Promise<any> {
    return TaskAttachments.create(data as any);
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