export interface SendOtpNotificationPayload {
  email: string;
  otpCode: string;
  purpose?: string;
  appName?: string;
  expiryMinutes?: number;
}
