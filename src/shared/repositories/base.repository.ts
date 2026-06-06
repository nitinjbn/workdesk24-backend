import { Model, ModelStatic, WhereOptions, FindOptions, Op } from 'sequelize';
import { BaseModel, PaginatedResponse, PaginationParams } from '../types/base.types';

export abstract class BaseRepository<T extends Model & BaseModel> {
  constructor(protected model: ModelStatic<T>) {}

  async findById(id: number): Promise<T | null> {
    return this.model.findOne({
      where: { id, isDeleted: 0 } as WhereOptions<T>,
    });
  }

  async findAll(options?: FindOptions<T>): Promise<T[]> {
    return this.model.findAll({
      ...options,
      where: {
        ...options?.where,
        isDeleted: 0,
      } as WhereOptions<T>,
    });
  }

  async findOne(where: WhereOptions<T>): Promise<T | null> {
    return this.model.findOne({
      where: {
        ...where,
        isDeleted: 0,
      } as WhereOptions<T>,
    });
  }

  async create(data: Partial<T>): Promise<T> {
    const now = Math.floor(Date.now() / 1000);

    console.log('Creating record with data:', { ...data, createdAt: now, updatedAt: now, isDeleted: 0, deletedAt: null });
    return this.model.create({
      ...data,
      createdAt: (data as any).createdAt || now,
      updatedAt: (data as any).updatedAt || now,
      isDeleted: 0,
      deletedAt: null,
    } as any);
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
      where: {
        ...where,
        isDeleted: 0,
      } as WhereOptions<T>,
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
      where: {
        ...where,
        isDeleted: 0,
      } as WhereOptions<T>,
    });
  }
}
