import { BaseModel } from '../../../shared/types/base.types';

export interface AttendanceAttributes extends BaseModel {
  userId: number;
  localId?: string;
  checkInTime: number;
  checkOutTime?: number;
  checkInLat?: number;
  checkInLng?: number;
  checkOutLat?: number;
  checkOutLng?: number;
  workingHours?: number;
  status: 'checked_in' | 'checked_out';
  notes?: string;
  syncedAt?: number;
}

export interface GpsHistoryAttributes extends BaseModel {
  userId: number;
  localId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  bearing?: number;
  timestamp: number;
  batteryLevel?: number;
  activityType?: string;
  syncedAt?: number;
}

export interface VisitAttributes extends BaseModel {
  userId: number;
  localId?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  address?: string;
  latitude?: number;
  longitude?: number;
  visitType: 'meeting' | 'delivery' | 'support' | 'sales' | 'other';
  purpose?: string;
  notes?: string;
  checkInTime: number;
  checkOutTime?: number;
  duration?: number;
  status: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  outcome?: 'success' | 'failed' | 'rescheduled' | 'not_available';
  syncedAt?: number;
}

export interface OrderAttributes extends BaseModel {
  userId: number;
  localId?: string;
  customerName: string;
  orderNumber: string;
  orderDate: number;
  totalAmount: number;
  status: 'pending' | 'confirmed' | 'delivered' | 'cancelled';
  notes?: string;
  syncedAt?: number;
}

export interface PaymentAttributes extends BaseModel {
  userId: number;
  localId?: string;
  customerName: string;
  paymentAmount: number;
  paymentDate: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'other';
  status: 'pending' | 'completed' | 'failed';
  notes?: string;
  syncedAt?: number;
}

export interface FeedbackAttributes extends BaseModel {
  userId: number;
  localId?: string;
  customerName: string;
  feedbackDate: number;
  rating: number;
  comments?: string;
  category: 'service' | 'product' | 'delivery' | 'other';
  syncedAt?: number;
}

export interface ImageAttributes extends BaseModel {
  userId: number;
  localId?: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  entityType: string;
  entityId: number;
  syncedAt?: number;
}
