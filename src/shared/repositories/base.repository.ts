import { Model, ModelStatic, WhereOptions, FindOptions, Op } from 'sequelize';
import { BaseModel, PaginatedResponse, PaginationParams } from '../types/base.types';

export abstract class BaseRepository<T extends Model & BaseModel> {
  constructor(protected model: ModelStatic<T>) {}

  private supportsSoftDelete(): boolean {
    const attributes = ((this.model as any).getAttributes?.() || (this.model as any).rawAttributes || {}) as Record<string, unknown>;
    return Object.prototype.hasOwnProperty.call(attributes, 'isDeleted');
  }

  private withSoftDelete(where?: WhereOptions<T>): WhereOptions<T> {
    if (!this.supportsSoftDelete()) {
      return (where || {}) as WhereOptions<T>;
    }

    return {
      ...(where || {}),
      isDeleted: 0,
    } as WhereOptions<T>;
  }

  async findById(id: number): Promise<T | null> {
    return this.model.findOne({
      where: this.withSoftDelete({ id } as WhereOptions<T>),
    });
  }

  async findAll(options?: FindOptions<T>): Promise<T[]> {
    return this.model.findAll({
      ...options,
      where: this.withSoftDelete(options?.where as WhereOptions<T> | undefined),
    });
  }

  async findOne(where: WhereOptions<T>): Promise<T | null> {
    return this.model.findOne({
      where: this.withSoftDelete(where),
    });
  }

  async create(data: Partial<T>): Promise<T> {
    const now = Math.floor(Date.now() / 1000);

    const payload: Record<string, unknown> = {
      ...data,
      createdAt: (data as any).createdAt || now,
      updatedAt: (data as any).updatedAt || now,
    };

    if (this.supportsSoftDelete()) {
      payload.isDeleted = 0;
      payload.deletedAt = null;
    }

    return this.model.create(payload as any);
  }

  async update(id: number, data: Partial<T>): Promise<T | null> {
    const instance = await this.findById(id);
    if (!instance) return null;

    const now = Math.floor(Date.now() / 1000);
    await instance.update({
      ...data,
      updatedAt: (data as any).updatedAt || now,
    } as any);

    return instance;
  }

  async delete(id: number): Promise<boolean> {
    const instance = await this.findById(id);
    if (!instance) return false;

    if (!this.supportsSoftDelete()) {
      await instance.destroy();
      return true;
    }

    const now = Math.floor(Date.now() / 1000);
    await instance.update({
      isDeleted: 1,
      deletedAt: now
    } as any);

    return true;
  }

  async hardDelete(id: number): Promise<boolean> {
    const result = await this.model.destroy({
      where: { id } as WhereOptions<T>,
    });
    return result > 0;
  }

  async paginate(params: PaginationParams, where?: WhereOptions<T>): Promise<PaginatedResponse<T>> {
    const { page, limit } = params;
    const offset = (page - 1) * limit;

    const { rows, count } = await this.model.findAndCountAll({
      where: this.withSoftDelete(where),
      limit,
      offset,
      order: [['createdAt', 'DESC']],
    });

    return {
      data: rows,
      pagination: {
        total: count,
        page,
        limit,
        totalPages: Math.ceil(count / limit),
      },
    };
  }

  async count(where?: WhereOptions<T>): Promise<number> {
    return this.model.count({
      where: this.withSoftDelete(where),
    });
  }
}
