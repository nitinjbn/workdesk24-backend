import inquiryRepository from '../repositories/inquiry.repository';
import { PaginationParams } from '../../../shared/types/base.types';
import { Op } from 'sequelize';

interface CreateInquiryDto {
  name: string;
  email: string;
  mobile?: string;
  subject: string;
  message: string;
  ipAddress?: string;
  userAgent?: string;
  source?: string;
  superAdminNotes?: string;
}

export class InquiryService {
  async createInquiry(data: CreateInquiryDto) {
    const noDuplicateWithinDays = 3;
    const isDuplicate = await this.isDuplicateInquiry(
      data.email,
      data.mobile || '',
      noDuplicateWithinDays
    );
    if (isDuplicate) {
      throw new Error(
        'Within the last 3 days, you have already submitted an inquiry. Please wait for the response.'
      );
    }
    return inquiryRepository.create({
      ...data,
    } as any);
  }

  async getAllInquiries(params: PaginationParams) {
    return inquiryRepository.paginate(params);
  }

  async getInquiryById(id: number) {
    const inquiry = await inquiryRepository.findById(id);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    return inquiry;
  }

  async updateInquiryStatus(id: number, status: string) {
    const inquiry = await inquiryRepository.update(id, { status } as any);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    return inquiry;
  }

  async updateInquiry(id: number, data: { priority?: string; adminNotes?: string }) {
    const inquiry = await inquiryRepository.update(id, data as any);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    return inquiry;
  }

  async assignInquiry(id: number, adminId: number) {
    const inquiry = await inquiryRepository.update(id, { assignedTo: adminId } as any);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    return inquiry;
  }

  async deleteInquiry(id: number) {
    const inquiry = await inquiryRepository.findById(id);
    if (!inquiry) {
      throw new Error('Inquiry not found');
    }
    await inquiryRepository.delete(id);
    return true;
  }

  async isDuplicateInquiry(email: string, mobile: string, withinDays: number = 1) {
    const normalizedEmail = email.trim().toLowerCase();
    const normalizedMobile = mobile.trim();

    const where = {
      isDeleted: 0,
      [Op.or]: [{ email: normalizedEmail }, { mobile: normalizedMobile }],
      createdAt: {
        [Op.gte]: Math.floor(Date.now() / 1000) - withinDays * 24 * 60 * 60,
      },
    };
    const inquiry = await inquiryRepository.findOne(where as any);
    return !!inquiry;
  }
}

export default new InquiryService();
