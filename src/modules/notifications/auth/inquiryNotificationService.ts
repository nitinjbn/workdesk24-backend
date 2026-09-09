import { EmailUtil } from '../../../shared/utils/email.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { CONFIG } from '../../../config/constants';
import notificationFacade from '../NotificationFacade';
import { SendSubmittedInquiryEmailToSalesTeamPayload } from './types/auth-notification.types';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

class InquiryNotificationService {
  async sendSubmittedInquiryEmailToSalesTeam(
    payload: SendSubmittedInquiryEmailToSalesTeamPayload
  ): Promise<{
    deliveryChannel: 'EMAIL';
    destination: string;
    messageId?: string;
    provider?: string;
    status?: string | null;
    failedReason?: string | null;
    sentAt?: number | null;
  }> {
    const sendResult = await notificationFacade.sendSubmittedInquiryEmailToSalesTeam({
      name: payload.name,
      email: payload.email,
      countryIsoCode: payload.countryIsoCode,
      mobile: payload.mobile,
      subject: payload.subject,
      message: payload.message,
      source: payload.source,
    });

    if (!sendResult.success) {
      return {
        deliveryChannel: 'EMAIL',
        destination: payload.email,
        messageId: sendResult.messageId || null,
        provider: sendResult.provider || null,
        status: 'FAILED',
        failedReason: sendResult.error || 'Failed to send OTP email',
        sentAt: null,
      };
      //throw createConfiguredError('FAILED_TO_SEND_OTP', sendResult.error || 'Failed to send OTP email', 500, 'INTERNAL_SERVER_ERROR');
    }

    return {
      deliveryChannel: 'EMAIL',
      destination: payload.email,
      messageId: sendResult.messageId,
      provider: sendResult.provider,
      status: 'SENT',
      sentAt: DateTimeFormatUtil.getCurrentUnixTime(),
    };
  }
}

export default new InquiryNotificationService();
