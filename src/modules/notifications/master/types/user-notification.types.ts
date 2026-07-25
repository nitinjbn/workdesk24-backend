export interface SyncUserSettingsNotificationPayload {
  hostId: number;
  userId: number;
  deviceId: string;
  fcmToken: string;
}

export interface PushNotificationDeliveryResult {
  deliveryChannel: 'PUSH';
  notificationId?: string | null;
  notificationLogId?: number | null;
  destination: string;
  messageId?: string | null;
  provider?: string | null;
  status: 'SENT' | 'FAILED';
  failedReason?: string | null;
  sentAt?: number | null;
}
