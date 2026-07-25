export interface SendOtpNotificationPayload {
  email: string;
  otpCode: string;
  purpose?: string;
  appName?: string;
  expiryMinutes?: number;
}

export interface SendOtpPushNotificationPayload {
  fcmToken: string;
  otpCode: string;
  purpose?: string;
  appName?: string;
  expiryMinutes?: number;
}
