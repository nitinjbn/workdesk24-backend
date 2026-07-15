import { NotificationResult } from '../../../types/notification.types';

export interface EmailAddress {
  email: string;
  name?: string;
}

export interface EmailMessage {
  to: string | string[];
  subject: string;
  text: string;
  html?: string;
  from?: EmailAddress;
  replyTo?: string;
}

export interface EmailSendResult extends NotificationResult {}

export interface EmailProvider {
  send(message: EmailMessage): Promise<EmailSendResult>;
}

export interface EmailTemplateData {
  subject: string;
  text: string;
  html: string;
}

export interface OtpEmailTemplateInput {
  otpCode: string;
  appName: string;
  purpose: string;
  expiryMinutes: number;
}
