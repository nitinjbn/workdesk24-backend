import { OtpPushPayload } from '../../../types/notification.types';
import { PushMessage } from '../types/push.types';
import { buildAuthOtpPushTemplate } from '../templates/auth-otp-push.template';

export const buildAuthOtpPushMessage = (payload: OtpPushPayload): PushMessage => {
  const template = buildAuthOtpPushTemplate({
    otpCode: payload.otpCode,
    appName: payload.appName,
    purpose: payload.purpose,
    expiryMinutes: payload.expiryMinutes,
  });

  return {
    token: payload.token,
    title: template.title,
    body: template.body,
    data: template.data,
  };
};
