import { OtpPushTemplateInput, PushTemplateData } from '../types/push.types';

export const buildAuthOtpPushTemplate = (input: OtpPushTemplateInput): PushTemplateData => {
  return {
    title: `${input.appName} OTP`,
    body: `Your OTP for ${input.purpose} is ${input.otpCode}. It expires in ${input.expiryMinutes} minutes.`,
    data: {
      type: 'AUTH_OTP',
      otpCode: input.otpCode,
      purpose: input.purpose,
      expiryMinutes: String(input.expiryMinutes),
    },
  };
};
