import { OtpPushPayload } from '../../../types/notification.types';
import { PushMessage } from '../types/push.types';
import { buildAuthOtpPushTemplate } from '../templates/auth-otp-push.template';

export const buildAuthOtpPushMessage = (payload: OtpPushPayload): PushMessage => {
  const template = buildAuthOtpPushTemplate(payload);

  return {
    token: payload.token,
    data: template.data,
  };
};
