import { BaseRepository } from '../../../shared/repositories/base.repository';
import Image from '../../../models/schemas/Image';
import { WhereOptions } from 'sequelize';

export class ImageRepository extends BaseRepository<typeof Image.prototype> {
  constructor() {
    super(Image as any);
  }

  async findByUserId(userId: number): Promise<typeof Image.prototype[]> {
    return this.findAll({
      where: { userId } as WhereOptions<typeof Image.prototype>,
      order: [['createdAt', 'DESC']],
    });
  }

  async findByLocalId(userId: number, localId: string): Promise<typeof Image.prototype | null> {
    return this.findOne({
      userId,
      localId,
    } as WhereOptions<typeof Image.prototype>);
  }

  async findByEntityType(entityType: string, entityId: number): Promise<typeof Image.prototype[]> {
    return this.findAll({
      where: {
        entityType,
        entityId,
      } as WhereOptions<typeof Image.prototype>,
      order: [['createdAt', 'DESC']],
    });
  }
}

export default new ImageRepository();
