import { Op, Transaction } from 'sequelize';
import { TaskTag, TaskTagMapping } from '../../../models';
import type { TaskTagSummary } from '../../../models/schemas/TaskTag';

type Tag = InstanceType<typeof TaskTag>;

export class TaskTagRepository {
  list(hostId: number, search?: string, isEnabled?: number) {
    return TaskTag.findAll({
      where: {
        hostId, isDeleted: 0,
        ...(search ? { name: { [Op.like]: `%${search}%` } } : {}),
        ...(isEnabled !== undefined ? { isEnabled } : {}),
      },
      order: [['name', 'ASC'], ['id', 'ASC']],
    });
  }

  find(hostId: number, tagId: number, transaction?: Transaction) {
    return TaskTag.findOne({
      where: { id: tagId, hostId, isDeleted: 0 },
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
  }

  create(data: Parameters<typeof TaskTag.create>[0]) {
    return TaskTag.create(data);
  }

  async update(tag: Tag, data: Partial<Tag['_attributes']>, transaction: Transaction) {
    await TaskTag.update(data, { where: { hostId: tag.hostId, id: tag.id }, transaction });
    tag.set(data);
    return tag;
  }

  lockTags(hostId: number, tagIds: number[], transaction: Transaction) {
    if (!tagIds.length) return Promise.resolve([]);
    return TaskTag.findAll({
      where: { hostId, id: { [Op.in]: tagIds } },
      order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE,
    });
  }

  findMappings(hostId: number, taskId: number, transaction: Transaction) {
    return TaskTagMapping.findAll({
      where: { hostId, taskId },
      order: [['id', 'ASC']], transaction, lock: transaction.LOCK.UPDATE,
    });
  }

  async replaceMappings(
    hostId: number, taskId: number,
    changes: { removeIds: number[]; restoreIds: number[]; newTagIds: number[] },
    now: number, transaction: Transaction
  ) {
    if (changes.removeIds.length) {
      await TaskTagMapping.update({ isDeleted: 1, deletedAt: now, updatedAt: now }, {
        where: { hostId, taskId, id: { [Op.in]: changes.removeIds } }, transaction,
      });
    }
    if (changes.restoreIds.length) {
      await TaskTagMapping.update({ isDeleted: 0, deletedAt: null, updatedAt: now }, {
        where: { hostId, taskId, id: { [Op.in]: changes.restoreIds } }, transaction,
      });
    }
    if (changes.newTagIds.length) {
      await TaskTagMapping.bulkCreate(changes.newTagIds.map((tagId) => ({
        hostId, taskId, tagId, createdAt: now, isDeleted: 0,
      })), { transaction });
    }
  }

  async tagsForTasks(hostId: number, taskIds: number[], transaction?: Transaction): Promise<Map<string, TaskTagSummary[]>> {
    const result = new Map<string, TaskTagSummary[]>();
    if (!taskIds.length) return result;
    const mappings = await TaskTagMapping.findAll({
      where: { hostId, taskId: { [Op.in]: taskIds }, isDeleted: 0 },
      attributes: ['id', 'taskId'],
      include: [{
        model: TaskTag, as: 'tag', required: true, where: { hostId },
        attributes: ['id', 'name', 'color', 'isEnabled', 'isDeleted'],
      }],
      order: [[{ model: TaskTag, as: 'tag' }, 'name', 'ASC'], ['tagId', 'ASC']],
      transaction,
    });
    for (const mapping of mappings) {
      const tags = result.get(String(mapping.taskId)) || [];
      const tag = mapping.tag!;
      tags.push({ id: tag.id, name: tag.name, color: tag.color, isEnabled: Number(tag.isEnabled), isDeleted: Number(tag.isDeleted) });
      result.set(String(mapping.taskId), tags);
    }
    return result;
  }
}

export default new TaskTagRepository();
