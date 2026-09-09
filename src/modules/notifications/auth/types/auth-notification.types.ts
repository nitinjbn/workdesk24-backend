export interface SendOtpNotificationPayload {
  email: string;
  otpCode: string;
  purpose?: string;
  appName?: string;
  expiryMinutes?: number;
}

export interface SendOtpPushNotificationPayload {
  fcmToken: string;
  otpCode: string;
  purpose?: string;
  appName?: string;
  expiryMinutes?: number;
}
export interface SendSubmittedInquiryEmailToSalesTeamPayload {
  name: string;
  email: string;
  countryIsoCode?: string;
  mobile: string;
  subject: string;
  message: string;
  source?: string;
}
