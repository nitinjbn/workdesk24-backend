import { CONFIG } from '../../../../../config/constants';
import { OtpPushTemplateInput, PushTemplateData } from '../types/push.types';

export const buildAuthOtpPushTemplate = (input: OtpPushTemplateInput): PushTemplateData => {
  return {
    data: {
        title: `${input.data?.appName} OTP`,
        body: `Your OTP for ${input.data?.purpose} is ${input.data?.otpCode}. It expires in ${input.data?.expiryMinutes} minutes.`,
        ...input.data as Record<string, string> || {},
    },
  };
};
