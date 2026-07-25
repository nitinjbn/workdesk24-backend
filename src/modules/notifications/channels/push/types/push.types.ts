import { NotificationResult } from '../../../types/notification.types';

export interface PushMessage {
  token: string;
  data?: Record<string, string>;
}

export interface PushSendResult extends NotificationResult {}

export interface PushProvider {
  send(message: PushMessage): Promise<PushSendResult>;
}

export interface OtpPushTemplateInput {
  data: Record<string, string>;
}

export interface PushTemplateData {
  data: Record<string, string>;
}

export enum NotificationType {
    AUTH_OTP = 'AUTH_OTP',
    SETTINGS = 'SETTINGS',
    VISIT = 'VISIT',
    ORDER = 'ORDER',
    PAYMENT = 'PAYMENT',
    FEEDBACK = 'FEEDBACK',
    IMAGES = 'IMAGES',
    PRODUCT = 'PRODUCT',
    CUSTOMER = 'CUSTOMER',
    ATTENDANCE = 'ATTENDANCE',
    SYSTEM = 'SYSTEM',
    LOCATION = 'LOCATION',
}

export enum NotificationAction {
    VERIFY_OTP = 'VERIFY_OTP',
    REFRESH_USER_SETTINGS = 'REFRESH_USER_SETTINGS',

    OPEN_ATTENDANCE = 'OPEN_ATTENDANCE',
    OPEN_VISIT = 'OPEN_VISIT',
    OPEN_REPORT = 'OPEN_REPORT',

    SYNC_PRODUCTS = 'SYNC_PRODUCTS',
    SYNC_CUSTOMERS = 'SYNC_CUSTOMERS',
    SYNC_ATTENDANCE = 'SYNC_ATTENDANCE',
    SYNC_VISIT = 'SYNC_VISIT',
    SYNC_ORDER = 'SYNC_ORDER',
    SYNC_PAYMENT = 'SYNC_PAYMENT',
    SYNC_FEEDBACK = 'SYNC_FEEDBACK',
    SYNC_IMAGES = 'SYNC_IMAGES',
    SYNC_LOCATION = 'SYNC_LOCATION',

    GET_LOCATION = 'GET_LOCATION',

    FORCE_LOGOUT = 'FORCE_LOGOUT',
}