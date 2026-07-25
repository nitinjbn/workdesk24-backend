import { NotificationResult } from '../../../types/notification.types';

export interface PushMessage {
  token: string;
  title: string;
  body: string;
  data?: Record<string, string>;
}

export interface PushSendResult extends NotificationResult {}

export interface PushProvider {
  send(message: PushMessage): Promise<PushSendResult>;
}

export interface OtpPushTemplateInput {
  otpCode: string;
  appName: string;
  purpose: string;
  expiryMinutes: number;
}

export interface PushTemplateData {
  title: string;
  body: string;
  data: Record<string, string>;
}
