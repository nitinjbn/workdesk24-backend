import { Transaction, UniqueConstraintError } from 'sequelize';
import { sequelize, TaskCategory } from '../../../models';
import { createConfiguredError } from '../../../shared/utils/error.util';
import categoryRepository, { TaskCategoryRepository } from '../repositories/task-category.repository';

interface CategoryScope { hostId: number; isAdmin: boolean }
interface CategoryFields {
  name?: unknown; description?: unknown; taskNumberPrefix?: unknown;
  nextTaskNumber?: unknown; isEnabled?: unknown;
}

function categoryError(code: string, message: string, status = 400) {
  return createConfiguredError(code, message, status, code);
}

function categoryData(category: InstanceType<typeof TaskCategory>) {
  const data = typeof category.toJSON === 'function' ? category.toJSON() : category;
  return {
    ...data,
    ...('taskCount' in data ? { taskCount: Number(data.taskCount) } : {}),
  };
}

export function taskCategoryId(value: unknown): number {
  if ((typeof value !== 'number' && typeof value !== 'string')
    || (typeof value === 'string' && !/^[1-9]\d*$/.test(value))
    || !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
    throw categoryError('INVALID_TASK_CATEGORY_ID', 'taskCategoryId must be a positive integer');
  }
  return Number(value);
}

export class TaskCategoryService {
  constructor(
    private readonly repository: TaskCategoryRepository = categoryRepository,
    private readonly transactionFactory: () => Promise<Transaction> = () => sequelize.transaction()
  ) {}

  private requireAdmin(scope: CategoryScope) {
    if (!scope.isAdmin) throw categoryError('TASK_ADMIN_REQUIRED', 'Admin access is required for this operation', 403);
    if (!Number.isSafeInteger(scope.hostId) || scope.hostId <= 0) {
      throw categoryError('INVALID_HOST_ID', 'Valid authenticated host is required', 401);
    }
  }

  private enabled(value: unknown): number {
    if (value !== 0 && value !== 1) throw categoryError('INVALID_CATEGORY_STATUS', 'isEnabled must be 0 or 1');
    return value;
  }

  private text(value: unknown, field: string, maximum: number): string {
    if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > maximum) {
      throw categoryError('INVALID_TASK_CATEGORY', `${field} must contain 1-${maximum} characters`);
    }
    return value.trim();
  }

  private fields(payload: CategoryFields, creating: boolean) {
    if (payload.nextTaskNumber !== undefined) {
      throw categoryError('CATEGORY_COUNTER_READ_ONLY', 'nextTaskNumber cannot be modified directly');
    }
    const data: { name?: string; description?: string | null; taskNumberPrefix?: string } = {};
    if (creating || payload.name !== undefined) data.name = this.text(payload.name, 'name', 100);
    if (creating || payload.taskNumberPrefix !== undefined) {
      data.taskNumberPrefix = this.text(payload.taskNumberPrefix, 'taskNumberPrefix', 20);
    }
    if (payload.description !== undefined) {
      if (payload.description !== null && (typeof payload.description !== 'string' || Array.from(payload.description).length > 500)) {
        throw categoryError('INVALID_TASK_CATEGORY', 'description must not exceed 500 characters');
      }
      data.description = typeof payload.description === 'string' ? payload.description.trim() || null : null;
    }
    return data;
  }

  private duplicate(error: unknown): never {
    if (error instanceof UniqueConstraintError) {
      const nameConflict = error.errors.some((item) => item.path?.includes('name') || item.path?.includes('Name'));
      throw categoryError(
        nameConflict ? 'TASK_CATEGORY_NAME_EXISTS' : 'TASK_CATEGORY_PREFIX_EXISTS',
        nameConflict ? 'A non-deleted category with this name already exists' : 'A non-deleted category with this task number prefix already exists',
        409
      );
    }
    throw error;
  }

  private async inTransaction<T>(operation: (transaction: Transaction) => Promise<T>): Promise<T> {
    const transaction = await this.transactionFactory();
    try {
      const result = await operation(transaction);
      await transaction.commit();
      return result;
    } catch (error) {
      await transaction.rollback();
      return this.duplicate(error);
    }
  }

  private async locked(scope: CategoryScope, id: unknown, transaction: Transaction) {
    const category = await this.repository.find(scope.hostId, taskCategoryId(id), transaction);
    if (!category) throw categoryError('TASK_CATEGORY_NOT_FOUND', 'Task category not found', 404);
    return category;
  }

  async list(payload: CategoryScope & {
    page?: unknown; limit?: unknown; search?: unknown; isEnabled?: unknown; sortBy?: unknown; sortOrder?: unknown;
  }) {
    this.requireAdmin(payload);
    const paginated = payload.page !== undefined || payload.limit !== undefined;
    for (const value of [payload.page, payload.limit]) {
      if (value !== undefined && ((typeof value !== 'number' && typeof value !== 'string')
        || (typeof value === 'string' && !/^[1-9]\d*$/.test(value)))) {
        throw categoryError('INVALID_CATEGORY_PAGINATION', 'page must be positive and limit must be 1-100');
      }
    }
    const page = payload.page === undefined ? 1 : Number(payload.page);
    const limit = payload.limit === undefined ? 20 : Number(payload.limit);
    if (!Number.isSafeInteger(page) || page < 1 || !Number.isSafeInteger(limit) || limit < 1 || limit > 100
      || !Number.isSafeInteger((page - 1) * limit)) {
      throw categoryError('INVALID_CATEGORY_PAGINATION', 'page must be positive and limit must be 1-100');
    }
    if (payload.search !== undefined && (typeof payload.search !== 'string' || Array.from(payload.search).length > 100)) {
      throw categoryError('INVALID_CATEGORY_SEARCH', 'search must be a string of at most 100 characters');
    }
    const sortBy = payload.sortBy === undefined ? 'name' : String(payload.sortBy);
    const sortOrder = payload.sortOrder === undefined ? 'ASC' : String(payload.sortOrder).toUpperCase();
    if (!['id', 'name', 'createdAt', 'updatedAt'].includes(sortBy) || !['ASC', 'DESC'].includes(sortOrder)) {
      throw categoryError('INVALID_CATEGORY_SORT', 'Invalid category sorting');
    }
    const result = await this.repository.list({
      hostId: payload.hostId,
      ...(paginated ? { page, limit } : {}),
      search: typeof payload.search === 'string' ? payload.search.trim() : undefined,
      isEnabled: payload.isEnabled === undefined ? undefined : this.enabled(payload.isEnabled),
      sortBy, sortOrder: sortOrder as 'ASC' | 'DESC',
    });
    return {
      categories: result.rows.map(categoryData),
      ...(paginated ? {
        pagination: { page, limit, total: result.count, totalPages: Math.ceil(result.count / limit) },
      } : {}),
    };
  }

  async create(payload: CategoryScope & CategoryFields) {
    this.requireAdmin(payload);
    const data = this.fields(payload, true);
    try {
      const category = await this.repository.create({
        hostId: payload.hostId, name: data.name!, taskNumberPrefix: data.taskNumberPrefix!,
        description: data.description ?? null, nextTaskNumber: 1,
        isEnabled: payload.isEnabled === undefined ? 1 : this.enabled(payload.isEnabled),
        isDeleted: 0, createdAt: Math.floor(Date.now() / 1000),
      });
      return { category: categoryData(category) };
    } catch (error) {
      return this.duplicate(error);
    }
  }

  async detail(payload: CategoryScope & { taskCategoryId: unknown }) {
    this.requireAdmin(payload);
    const category = await this.repository.detail(payload.hostId, taskCategoryId(payload.taskCategoryId));
    if (!category) throw categoryError('TASK_CATEGORY_NOT_FOUND', 'Task category not found', 404);
    return { category: categoryData(category) };
  }

  async update(payload: CategoryScope & CategoryFields & { taskCategoryId: unknown }) {
    this.requireAdmin(payload);
    const data = this.fields(payload, false);
    if (payload.isEnabled !== undefined) throw categoryError('INVALID_TASK_CATEGORY', 'Use toggle-status to change isEnabled');
    if (!Object.keys(data).length) throw categoryError('INVALID_TASK_CATEGORY', 'At least one category field is required');
    return this.inTransaction(async (transaction) => {
      const category = await this.locked(payload, payload.taskCategoryId, transaction);
      return { category: categoryData(await this.repository.update(category, { ...data, updatedAt: Math.floor(Date.now() / 1000) }, transaction)) };
    });
  }

  async remove(payload: CategoryScope & { taskCategoryId: unknown }) {
    this.requireAdmin(payload);
    return this.inTransaction(async (transaction) => {
      const category = await this.locked(payload, payload.taskCategoryId, transaction);
      if (await this.repository.countTasks(payload.hostId, category.id, transaction)) {
        throw categoryError('TASK_CATEGORY_IN_USE', 'Cannot delete a category with associated tasks', 409);
      }
      const now = Math.floor(Date.now() / 1000);
      await this.repository.update(category, { isDeleted: 1, deletedAt: now, updatedAt: now }, transaction);
      return { taskCategoryId: category.id };
    });
  }

  async toggleStatus(payload: CategoryScope & { taskCategoryId: unknown; isEnabled: unknown }) {
    this.requireAdmin(payload);
    const isEnabled = this.enabled(payload.isEnabled);
    return this.inTransaction(async (transaction) => {
      const category = await this.locked(payload, payload.taskCategoryId, transaction);
      return { category: categoryData(await this.repository.update(category, { isEnabled, updatedAt: Math.floor(Date.now() / 1000) }, transaction)) };
    });
  }
}

export default new TaskCategoryService();
