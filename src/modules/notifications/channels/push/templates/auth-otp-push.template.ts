import { CONFIG } from '../../../../../config/constants';
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
      allowAutoFill: String(!!(CONFIG.OTP.AUTH.ALLOW_AUTO_FILL || false)), // This can be used by the client app to determine if it should auto-fill the OTP
    },
  };
};
