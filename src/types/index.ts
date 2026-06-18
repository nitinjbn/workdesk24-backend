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
  customerCode?: string;
  customerId?: number;
  contactPerson?: string;
  customerPhone?: string;
  customerEmail?: string;
  customerAddress?: string;
  customerType?: string;
  checkInLatitude?: number;
  checkInLongitude?: number;
  checkInLocationAccuracy?: number;
  checkInLocationAltitude?: number;
  checkInLocationSpeed?: number;
  checkInLocationProvider?: string;
  checkInBatteryPercentage?: number;
  isChargingOnCheckIn?: number;
  checkOutLatitude?: number;
  checkOutLongitude?: number;
  checkOutLocationAccuracy?: number;
  checkOutLocationAltitude?: number;
  checkOutLocationSpeed?: number;
  checkOutLocationProvider?: string;
  checkOutBatteryPercentage?: number;
  isChargingOnCheckOut?: number;
  purpose?: string;
  remarks?: string;
  checkInTime: number;
  checkOutTime?: number;
  visitDuration?: number;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  isDeleted?: number;
  deletedAt?: number | null;
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
  localId?: string;
  visitId: number;
  paymentCaptureTime?: number;
  transactionId?: string;
  amount: number;
  paymentMode: string;
  paymentDate: number;
  remarks?: string;
  chequeNumber?: string;
  paymentProofImageUrl?: string;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationAltitude?: number;
  locationSpeed?: number;
  locationProvider?: string;
  batteryPercentage?: number;
  isChargingOnPayment?: number;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  isDeleted?: number;
  deletedAt?: number | null;
}

// Feedback attributes
export interface FeedbackAttributes {
  id?: number;
  userId: number;
  localId?: string;
  visitId?: number;
  message: string;
  mediaUrl?: string;
  mediaType?: string;
  feedbackTime: number;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationAltitude?: number;
  locationSpeed?: number;
  locationProvider?: string;
  batteryPercentage?: number;
  isChargingOnFeedback?: number;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  isDeleted?: number;
  deletedAt?: number | null;
}

// Image attributes
export interface ImageAttributes {
  id?: number;
  userId: number;
  localId?: string;
  visitId?: number;
  caption: string;
  mediaUrl?: string;
  mediaType?: string;
  capturedAt: number;
  latitude?: number;
  longitude?: number;
  locationAccuracy?: number;
  locationAltitude?: number;
  locationSpeed?: number;
  locationProvider?: string;
  batteryPercentage?: number;
  isCharging?: number;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  isDeleted?: number;
  deletedAt?: number | null;
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
