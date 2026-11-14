import { Transaction, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../../../models';
import { createConfiguredError } from '../../../shared/utils/error.util';
import tagRepository, { TaskTagRepository } from '../repositories/task-tag.repository';
import { parseTaskEntityId } from './task-rules.util';

interface TagScope { hostId: number; isAdmin: boolean }
interface TagFields { name?: unknown; color?: unknown; description?: unknown; isEnabled?: unknown }

function tagError(code: string, message: string, status = 400) {
  return createConfiguredError(code, message, status, code);
}

export class TaskTagService {
  constructor(
    private readonly repository: TaskTagRepository = tagRepository,
    private readonly transactionFactory: () => Promise<Transaction> = () => sequelize.transaction()
  ) {}

  private requireScope(scope: TagScope, adminOnly = true) {
    if (adminOnly && !scope.isAdmin) throw tagError('TASK_ADMIN_REQUIRED', 'Admin access is required for this operation', 403);
    if (!Number.isSafeInteger(scope.hostId) || scope.hostId <= 0) {
      throw tagError('INVALID_HOST_ID', 'Valid authenticated host is required', 401);
    }
  }

  private enabled(value: unknown): number {
    if (value !== 0 && value !== 1) throw tagError('INVALID_TASK_TAG_STATUS', 'isEnabled must be 0 or 1');
    return value;
  }

  private search(value: unknown): string | undefined {
    if (value === undefined) return undefined;
    if (typeof value !== 'string' || Array.from(value).length > 50) {
      throw tagError('INVALID_TASK_TAG_SEARCH', 'search must be a string of at most 50 characters');
    }
    return value.trim();
  }

  private fields(payload: TagFields, creating: boolean) {
    const data: { name?: string; color?: string; description?: string | null } = {};
    if (creating || payload.name !== undefined) {
      if (typeof payload.name !== 'string' || !payload.name.trim() || Array.from(payload.name.trim()).length > 50) {
        throw tagError('INVALID_TASK_TAG_NAME', 'name must contain 1-50 characters');
      }
      data.name = payload.name.trim();
    }
    if (creating || payload.color !== undefined) {
      if (typeof payload.color !== 'string' || payload.color.length !== 7 || !/^#[0-9a-fA-F]{6}$/.test(payload.color)) {
        throw tagError('INVALID_TASK_TAG_COLOR', 'color must be a hexadecimal color in #RRGGBB format');
      }
      data.color = payload.color.toUpperCase();
    }
    if (payload.description !== undefined) {
      if (payload.description !== null && (typeof payload.description !== 'string' || Array.from(payload.description).length > 255)) {
        throw tagError('INVALID_TASK_TAG_DESCRIPTION', 'description must not exceed 255 characters');
      }
      data.description = typeof payload.description === 'string' ? payload.description.trim() || null : null;
    }
    return data;
  }

  private duplicate(error: unknown): never {
    if (error instanceof UniqueConstraintError) {
      throw tagError('TASK_TAG_NAME_EXISTS', 'A tag with this name already exists in this host, including deleted tags', 409);
    }
    throw error;
  }

  private async mutate(
    payload: TagScope & { tagId: unknown },
    data: { name?: string; color?: string; description?: string | null; isEnabled?: number; isDeleted?: number; deletedAt?: number }
  ) {
    const id = parseTaskEntityId(payload.tagId, 'tagId');
    const transaction = await this.transactionFactory();
    try {
      const tag = await this.repository.find(payload.hostId, id, transaction);
      if (!tag) throw tagError('TASK_TAG_NOT_FOUND', 'Task tag not found', 404);
      const updated = await this.repository.update(tag, { ...data, updatedAt: Math.floor(Date.now() / 1000) }, transaction);
      await transaction.commit();
      return { tag: updated.toJSON() };
    } catch (error) {
      await transaction.rollback();
      return this.duplicate(error);
    }
  }

  async list(payload: TagScope & { search?: unknown; isEnabled?: unknown }) {
    this.requireScope(payload);
    const tags = await this.repository.list(payload.hostId, this.search(payload.search),
      payload.isEnabled === undefined ? undefined : this.enabled(payload.isEnabled));
    return { tags: tags.map((tag) => tag.toJSON()) };
  }

  async listEnabled(payload: TagScope & { search?: unknown }) {
    this.requireScope(payload, false);
    const tags = await this.repository.list(payload.hostId, this.search(payload.search), 1);
    return { tags: tags.map((tag) => ({ id: tag.id, name: tag.name, color: tag.color })) };
  }

  async create(payload: TagScope & TagFields) {
    this.requireScope(payload);
    const data = this.fields(payload, true);
    try {
      const tag = await this.repository.create({
        hostId: payload.hostId, name: data.name!, color: data.color!, description: data.description ?? null,
        isEnabled: payload.isEnabled === undefined ? 1 : this.enabled(payload.isEnabled),
        isDeleted: 0, createdAt: Math.floor(Date.now() / 1000),
      });
      return { tag: tag.toJSON() };
    } catch (error) {
      return this.duplicate(error);
    }
  }

  async detail(payload: TagScope & { tagId: unknown }) {
    this.requireScope(payload);
    const tag = await this.repository.find(payload.hostId, parseTaskEntityId(payload.tagId, 'tagId'));
    if (!tag) throw tagError('TASK_TAG_NOT_FOUND', 'Task tag not found', 404);
    return { tag: tag.toJSON() };
  }

  async update(payload: TagScope & TagFields & { tagId: unknown }) {
    this.requireScope(payload);
    if (payload.isEnabled !== undefined) throw tagError('INVALID_TASK_TAG_STATUS', 'Use toggle-status to change isEnabled');
    const data = this.fields(payload, false);
    if (!Object.keys(data).length) throw tagError('INVALID_TASK_TAG', 'At least one tag field is required');
    return this.mutate(payload, data);
  }

  async remove(payload: TagScope & { tagId: unknown }) {
    this.requireScope(payload);
    const result = await this.mutate(payload, { isDeleted: 1, deletedAt: Math.floor(Date.now() / 1000) });
    return { tagId: result.tag.id };
  }

  async toggleStatus(payload: TagScope & { tagId: unknown; isEnabled: unknown }) {
    this.requireScope(payload);
    return this.mutate(payload, { isEnabled: this.enabled(payload.isEnabled) });
  }
}

export default new TaskTagService();
