import { Request } from 'express';

// Extend Express Request to include user
export interface AuthRequest extends Request {
  user?: {
    id: number;
    email: string;
    name: string;
  };
  body: any;
}

// Sync record with localId
export interface SyncRecord {
  localId?: string;
  [key: string]: any;
}

// Sync response structure
export interface SyncResponse {
  success: Array<{
    localId: string;
    serverId: number;
  }>;
  updated: Array<{
    localId: string;
    serverId: number;
  }>;
  failed: Array<{
    localId: string;
    error: string;
  }>;
}

// Pagination params
export interface PaginationParams {
  page?: number;
  limit?: number;
}

// Attendance attributes
export interface AttendanceAttributes {
  id?: number;
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
  createdAt?: number;
  updatedAt?: number;
}

// GPS History attributes
export interface GpsHistoryAttributes {
  id?: number;
  userId: number;
  localId?: string;
  latitude: number;
  longitude: number;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  provider?: string;
  batteryPercentage?: number;
  isCharging?: number;
  createdAt?: number;
  updatedAt?: number | null;  
  syncedAt?: number;
  isDeleted?: number;
  deletedAt?: number | null;
}

// Visit attributes
export interface VisitAttributes {
  id?: number;
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
  createdAt?: number;
  updatedAt?: number;
}

// Order attributes
export interface OrderAttributes {
  id?: number;
  userId: number;
  localId?: string;
  orderNumber?: string;
  customerName: string;
  customerPhone?: string;
  customerEmail?: string;
  deliveryAddress?: string;
  items?: any; // JSON
  totalAmount: number;
  taxAmount?: number;
  discountAmount?: number;
  netAmount: number;
  status: 'pending' | 'confirmed' | 'processing' | 'shipped' | 'delivered' | 'cancelled';
  paymentStatus: 'pending' | 'partial' | 'paid' | 'refunded';
  orderDate: number;
  deliveryDate?: number;
  notes?: string;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

// Payment attributes
export interface PaymentAttributes {
  id?: number;
  userId: number;
  orderId?: number;
  localId?: string;
  transactionId?: string;
  amount: number;
  paymentMethod: 'cash' | 'card' | 'upi' | 'bank_transfer' | 'cheque' | 'other';
  paymentDate: number;
  status: 'pending' | 'completed' | 'failed' | 'refunded';
  referenceNumber?: string;
  notes?: string;
  latitude?: number;
  longitude?: number;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

// Feedback attributes
export interface FeedbackAttributes {
  id?: number;
  userId: number;
  localId?: string;
  relatedType: 'visit' | 'order' | 'product' | 'service' | 'general';
  relatedId?: number;
  customerName?: string;
  customerPhone?: string;
  rating?: number;
  category?: string;
  subject?: string;
  message: string;
  sentiment?: 'positive' | 'neutral' | 'negative';
  status: 'pending' | 'reviewed' | 'resolved' | 'archived';
  feedbackDate: Date;
  latitude?: number;
  longitude?: number;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

// Image attributes
export interface ImageAttributes {
  id?: number;
  userId: number;
  localId?: string;
  relatedType: 'visit' | 'order' | 'payment' | 'feedback' | 'attendance' | 'profile' | 'other';
  relatedId?: number;
  fileName: string;
  originalName?: string;
  filePath: string;
  fileSize?: number;
  mimeType?: string;
  base64Data?: string;
  width?: number;
  height?: number;
  latitude?: number;
  longitude?: number;
  capturedAt?: number;
  description?: string;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
}

// User attributes
export interface UserAttributes {
  id?: number;
  email: string;
  password: string;
  name?: string;
  createdAt?: number;
  updatedAt?: number;
}

// Inquiry attributes
export interface InquiryAttributes {
  id?: number;
  name: string;
  email: string;
  phone?: string;
  subject: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  source?: string;
  ipAddress?: string;
  userAgent?: string;
  assignedTo?: number;
  adminNotes?: string;
  resolvedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  isDeleted?: number;
  deletedAt?: number | null;
}

// Sync All Data interface
export interface SyncAllData {
  attendance?: SyncRecord[];
  gpsHistory?: SyncRecord[];
  visits?: SyncRecord[];
  orders?: SyncRecord[];
  payments?: SyncRecord[];
  feedback?: SyncRecord[];
  images?: SyncRecord[];
}

// API Response
export interface ApiResponse<T = any> {
  success: boolean;
  message: string;
  data?: T;
  error?: string;
}

// JWT Payload
export interface JwtPayload {
  userId: number;
  email: string;
}

// Environment variables
export interface EnvironmentVariables {
  NODE_ENV: string;
  PORT: string;
  DB_HOST: string;
  DB_USER: string;
  DB_PASSWORD: string;
  DB_NAME: string;
  JWT_SECRET: string;
  JWT_EXPIRES_IN: string;
  EMAIL_HOST: string;
  EMAIL_PORT: string;
  EMAIL_USER: string;
  EMAIL_PASSWORD: string;
  EMAIL_FROM: string;
}
