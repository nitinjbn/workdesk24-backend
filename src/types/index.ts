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
  visitId?: number;
  customerId?: number;
  totalAmount: number;
  taxAmount?: number;
  totalDiscount?: number;
  totalUniqueProducts?: number;
  totalQuantity?: number;
  orderTime: number;
  remarks?: string;
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

// Order Product attributes
export interface OrderProductAttributes {
  id?: number;
  orderId: number;
  userId: number;
  localId?: string;
  visitId?: number;
  customerId?: number;
  productId?: number;
  productName: string;
  productCode?: string;
  description?: string;
  quantity: number;
  mrp?: number;
  discountPercentage?: number;
  discountAmount?: number;
  taxAmount?: number;
  totalAmount?: number;
  syncedAt?: number;
  createdAt?: number;
  updatedAt?: number;
  isDeleted?: number;
  deletedAt?: number | null;
}

// Product attributes
export interface ProductAttributes {
  id?: number;
  hostId: number;
  productCode?: string;
  productName: string;
  shortName?: string;
  remarks?: string;
  categoryId?: number;
  brandId?: number;
  uomId?: number;
  sku?: string;
  barcode?: string;
  hsnCode?: string;
  purchasePrice?: number;
  sellingPrice?: number;
  mrp?: number;
  taxPercentage?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

// Payment attributes
export interface PaymentAttributes {
  id?: number;
  userId: number;
  localId?: string;
  visitId?: number;
  amount: number;
  paymentMode: string;
  paymentDate: number;
  remarks?: string;
  chequeNumber?: string;
  transactionId?: string;
  paymentProofImageUrl?: string;
  paymentCaptureTime?: number;
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
  hostId: number;
  roleId: number;
  employeeId?: number;
  mobile: string;
  email: string;
  password: string;
  name?: string;
  reportingManagerId?: number;
  lastLoginAt?: number;
  profileImageUrl?: string;
  joiningDate?: number;
  isActive?: number;
  createdAt?: number;
  updatedAt?: number;
  isDeleted?: number;
  deletedAt?: number | null;
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

export interface ProductCategoryAttributes {
  id?: number;
  hostId: number;
  categoryName: string;
  remarks?: string;
  parentCategoryId?: number;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface UOMAttributes {
  id?: number;
  hostId: number;
  uomCode: string;
  uomName: string;
  remarks?: string;
  parentCategoryId?: number;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface ProductAttributeAttributes {
  id?: number;
  hostId: number;
  productId: number;
  attributeGroup: string;
  attributeName: string;
  attributeValue: string;
  attributeType: 'TEXT' | 'NUMBER' | 'DECIMAL' | 'DATE' | 'BOOLEAN' | 'JSON';
  attributeUomId?: number;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface ProductBrandAttributes {
  id?: number;
  hostId: number;
  brandName: string;
  remarks?: string;
  parentCategoryId?: number;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface ProductMediaAttributes {
  id?: number;
  hostId: number;
  productId: number;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'PDF' | 'DOCUMENT' | 'BROCHURE' | 'CERTIFICATE' | 'LABEL' | 'MANUAL';
  thumbnailUrl?: string;
  publicId?: string;
  fileName?: string;
  fileSizeInBytes?: number;
  mimeType?: string;
  isPrimary?: number;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface RoleAttributes {
  id?: number;
  hostId: number;
  roleCode: string;
  roleName: string;
  remarks?: string;
  isSystemRole?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface PermissionAttributes {
  id?: number;
  permissionCode: string;
  permissionName: string;
  moduleName: string;
  remarks?: string;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface RolePermissionAttributes {
  id?: number;
  hostId: number;
  roleId: number;
  permissionId: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface HostAttributes {
  id?: number;
  companyName: string;
  companyLogoUrl?: string;
  websiteUrl?: string;
  contactPerson?: string;
  mobile?: string;
  email?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  gstNumber?: string;
  panNumber?: string;
  isActive?: number;
  lastLoginAt?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface CustomerTypeAttributes {
  id?: number;
  hostId: number;
  customerTypeName: string;
  sortOrder: number;
  remarks?: string;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface CustomerAttributes {
  id?: number;
  hostId: number;
  parentCustomerId?: number;
  customerCode?: string;
  customerName: string;
  customerTypeId?: number;
  contactPerson?: string;
  mobile?: string;
  alternateMobile?: string;
  email?: string;
  gstNumber?: string;
  panNumber?: string;
  addressLine1?: string;
  addressLine2?: string;
  city?: string;
  state?: string;
  postalCode?: string;
  country?: string;
  latitude?: number;
  longitude?: number;
  remarks?: string;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface CustomerAttributeAttributes {
  id?: number;
  hostId: number;
  customerId: number;
  attributeGroup: string;
  attributeName: string;
  attributeValue: string;
  attributeType: 'TEXT' | 'NUMBER' | 'DECIMAL' | 'DATE' | 'BOOLEAN' | 'JSON';
  attributeUomId?: number;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface CustomerMediaAttributes {
  id?: number;
  hostId: number;
  customerId: number;
  mediaUrl: string;
  mediaType: 'IMAGE' | 'VIDEO' | 'PDF' | 'DOCUMENT' | 'BROCHURE' | 'CERTIFICATE' | 'LABEL' | 'MANUAL';
  thumbnailUrl?: string;
  publicId?: string;
  fileName?: string;
  fileSizeInBytes?: number;
  mimeType?: string;
  isPrimary?: number;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface SubscriptionPlanAttributes {
  id?: number;
  planName: string;
  planCode: string;
  description?: string;
  price: number;
  durationInDays: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface SubscriptionCycleAttributes {
  id?: number;
  cycleCode: string;
  cycleName: string;
  validityInMonths: number;
  perUserMonthlyPrice: number;
  perUserSetupPrice: number;
  minimumUsers: number;
  isPopular: number;
  remarks?: string;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface FeatureAttributes {
  id?: number;
  featureCode: string;
  featureName: string;
  remarks?: string;
  sortOrder?: number;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface SubscriptionCycleFeaturesAttributes {
  id?: number;
  subscriptionCycleId: number;
  featureId: number;
  remarks?: string;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface HostSubscriptionAttributes {
  id?: number;
  hostId: number;
  subscriptionCycleId: number;
  licensedUserCount: number;
  validityInMonths: number;
  perUserMonthlyPrice: number;
  perUserSetupPrice: number;
  discountType?: 'PERCENTAGE' | 'FIXED';
  discountValue?: number;
  grossAmount: number;
  discountAmount: number;
  netAmount: number;
  planStartDate: number;
  planEndDate: number;
  paymentStatus: 'PENDING' | 'PAID';
  paymentReference?: string;
  remarks?: string;
  isEnabled?: number;
  isDeleted?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
}

export interface HostSettingsAttributes {
  id?: number;
  hostId: number;
  settingName: string;
  settingValue: string;
  remarks?: string;
  isEnabled?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
  isDeleted?: number;
}

export interface UserSettingsAttributes {
  id?: number;
  userId: number;
  settingName: string;
  settingValue: string;
  remarks?: string;
  isEnabled?: number;
  createdAt?: number;
  updatedAt?: number;
  deletedAt?: number | null;
  isDeleted?: number;
}