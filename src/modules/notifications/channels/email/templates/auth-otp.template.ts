import { OtpEmailTemplateInput, EmailTemplateData } from '../types/email.types';

export const buildAuthOtpEmailTemplate = (
  input: OtpEmailTemplateInput
): EmailTemplateData => {
  const { otpCode, appName, purpose, expiryMinutes } = input;

  const subject = `${appName} OTP for ${purpose}`;
  const text = [
    `Your OTP for ${purpose} is: ${otpCode}`,
    `This OTP will expire in ${expiryMinutes} minutes.`,
    'If you did not request this OTP, please ignore this email.'
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 12px;">${appName} Verification</h2>
      <p style="margin: 0 0 12px;">Use the OTP below for ${purpose}:</p>
      <div style="font-size: 28px; letter-spacing: 6px; font-weight: 700; margin: 8px 0 14px;">${otpCode}</div>
      <p style="margin: 0 0 8px;">This OTP will expire in <strong>${expiryMinutes} minutes</strong>.</p>
      <p style="margin: 0; color: #6b7280;">If you did not request this OTP, please ignore this email.</p>
    </div>
  `;

  return { subject, text, html };
};
