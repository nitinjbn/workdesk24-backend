import { Op, literal, Transaction } from 'sequelize';
import { Task, TaskCategory } from '../../../models';

type Category = InstanceType<typeof TaskCategory>;
const taskCount = literal(
  '(SELECT COUNT(*) FROM wd_tasks AS categoryTasks WHERE categoryTasks.taskCategoryId = TaskCategory.id AND categoryTasks.hostId = TaskCategory.hostId)'
);

export class TaskCategoryRepository {
  find(hostId: number, taskCategoryId: number, transaction?: Transaction) {
    return TaskCategory.findOne({
      where: { id: taskCategoryId, hostId, isDeleted: 0 },
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
  }

  detail(hostId: number, taskCategoryId: number) {
    return TaskCategory.findOne({
      attributes: { include: [[taskCount, 'taskCount']] },
      where: { id: taskCategoryId, hostId, isDeleted: 0 },
    });
  }

  list(params: {
    hostId: number; search?: string; isEnabled?: number;
    page?: number; limit?: number; sortBy: string; sortOrder: 'ASC' | 'DESC';
  }) {
    return TaskCategory.findAndCountAll({
      attributes: { include: [[taskCount, 'taskCount']] },
      where: {
        hostId: params.hostId,
        isDeleted: 0,
        ...(params.search ? { name: { [Op.like]: `%${params.search}%` } } : {}),
        ...(params.isEnabled !== undefined ? { isEnabled: params.isEnabled } : {}),
      },
      order: [[params.sortBy, params.sortOrder], ['id', 'ASC']],
      ...(params.limit !== undefined ? {
        limit: params.limit,
        offset: ((params.page ?? 1) - 1) * params.limit,
      } : {}),
    });
  }

  create(data: Parameters<typeof TaskCategory.create>[0]) {
    return TaskCategory.create(data);
  }

  update(category: Category, data: Partial<Category['_attributes']>, transaction: Transaction) {
    return category.update(data, { transaction });
  }

  countTasks(hostId: number, taskCategoryId: number, transaction: Transaction) {
    return Task.count({ where: { hostId, taskCategoryId }, transaction });
  }
}

export default new TaskCategoryRepository();
