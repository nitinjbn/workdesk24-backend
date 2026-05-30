import { BaseRepository } from '../../../shared/repositories/base.repository';
import User from '../../../models/schemas/User';
import { WhereOptions } from 'sequelize';
import bcrypt from 'bcryptjs';

export class UserRepository extends BaseRepository<typeof User.prototype> {
  constructor() {
    super(User as any);
  }

  async create(data: Partial<typeof User.prototype>): Promise<typeof User.prototype> {
    // Hash password before creating
    if (data.password) {
      data.password = await bcrypt.hash(data.password, 10);
    }

    // Set default values
    const now = Math.floor(Date.now() / 1000);
    return this.model.create({
      ...data,
      role: (data as any).role || 'user',
      isActive: (data as any).isActive !== undefined ? (data as any).isActive : 1,
      lastLoginAt: (data as any).lastLoginAt || null,
      createdAt: now,
      updatedAt: now,
      isDeleted: 0,
      deletedAt: null,
    } as any);
  }

  async findByEmail(email: string): Promise<typeof User.prototype | null> {
    return this.findOne({ email } as WhereOptions<typeof User.prototype>);
  }

  async existsByEmail(email: string): Promise<boolean> {
    const count = await this.count({ email } as WhereOptions<typeof User.prototype>);
    return count > 0;
  }

  async findWithPassword(email: string): Promise<typeof User.prototype | null> {
    return this.model.findOne({
      where: { email, isDeleted: 0 } as WhereOptions<typeof User.prototype>,
      attributes: { include: ['password'] },
    });
  }
}

export default new UserRepository();
