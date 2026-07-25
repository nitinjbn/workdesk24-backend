export type NotificationChannel = 'EMAIL' | 'SMS' | 'PUSH' | 'WHATSAPP';

export interface NotificationResult {
  success: boolean;
  messageId?: string;
  provider?: string;
  error?: string;
}

export interface NotificationRequest<TPayload = unknown> {
  channel: NotificationChannel;
  payload: TPayload;
}

export interface OtpEmailPayload {
  to: string;
  otpCode: string;
  appName: string;
  purpose: string;
  expiryMinutes: number;
}

export interface OtpPushPayload {
  token: string;
  data: Record<string, string>;
}
