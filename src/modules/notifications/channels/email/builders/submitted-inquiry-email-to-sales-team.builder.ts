import { InquiryEmailPayload } from '../../../types/notification.types';
import { EmailMessage } from '../types/email.types';
import { buildSubmittedInquiryEmailToSalesTeamTemplate } from '../templates/submitted-inquiry-email-to-sales-team.template';
import { CONFIG } from '../../../../../config/constants';

export const buildSubmittedInquiryEmailToSalesTeamMessage = (
  payload: InquiryEmailPayload
): EmailMessage => {
  const template = buildSubmittedInquiryEmailToSalesTeamTemplate({
    name: payload.name,
    email: payload.email,
    mobile: payload.mobile,
    countryIsoCode: payload.countryIsoCode,
    message: payload.message,
    source: payload.source,
  });

  return {
    to: CONFIG.NOTIFICATIONS.SALES_TEAM_ADDRESS,
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
