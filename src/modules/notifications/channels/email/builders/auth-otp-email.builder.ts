import { OtpEmailPayload } from '../../../types/notification.types';
import { EmailMessage } from '../types/email.types';
import { buildAuthOtpEmailTemplate } from '../templates/auth-otp.template';
import { CONFIG } from '../../../../../config/constants';

export const buildAuthOtpEmailMessage = (payload: OtpEmailPayload): EmailMessage => {
  const template = buildAuthOtpEmailTemplate({
    otpCode: payload.otpCode,
    appName: payload.appName,
    purpose: payload.purpose,
    expiryMinutes: payload.expiryMinutes,
  });

  return {
    to: payload.to,
    subject: template.subject,
    text: template.text,
    html: template.html,
    from: {
      email: CONFIG.NOTIFICATIONS.EMAIL.FROM_ADDRESS,
      name: CONFIG.NOTIFICATIONS.EMAIL.FROM_NAME,
    },
    replyTo: CONFIG.NOTIFICATIONS.EMAIL.REPLY_TO || undefined,
  };
};
