import { BaseRepository } from '../../../shared/repositories/base.repository';
import Inquiry from '../../../models/schemas/Inquiry';
import { WhereOptions } from 'sequelize';

export class InquiryRepository extends BaseRepository<typeof Inquiry.prototype> {
  constructor() {
    super(Inquiry as any);
  }

  async findByEmail(email: string): Promise<typeof Inquiry.prototype[]> {
    return this.findAll({
      where: { email } as WhereOptions<typeof Inquiry.prototype>,
      order: [['createdAt', 'DESC']],
    });
  }

  async findByStatus(status: string): Promise<typeof Inquiry.prototype[]> {
    return this.findAll({
      where: { status } as WhereOptions<typeof Inquiry.prototype>,
      order: [['createdAt', 'DESC']],
    });
  }
}

export default new InquiryRepository();
