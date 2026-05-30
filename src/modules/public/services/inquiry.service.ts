import inquiryRepository from '../repositories/inquiry.repository';
import { PaginationParams } from '../../../shared/types/base.types';

interface CreateInquiryDto {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}

export class InquiryService {
  async createInquiry(data: CreateInquiryDto) {
    return inquiryRepository.create({
      ...data,
      status: 'pending',
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
}

export default new InquiryService();
