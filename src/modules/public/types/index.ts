import { BaseModel } from '../../../shared/types/base.types';

export interface InquiryAttributes extends BaseModel {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  ipAddress?: string;
  userAgent?: string;
  assignedTo?: number;
  adminNotes?: string;
}

export interface CreateInquiryDto {
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
}
