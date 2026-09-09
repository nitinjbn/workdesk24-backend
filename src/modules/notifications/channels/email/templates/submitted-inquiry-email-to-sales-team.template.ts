import { InquiryEmailTemplateInput, EmailTemplateData } from '../types/email.types';

export const buildSubmittedInquiryEmailToSalesTeamTemplate = (
  input: InquiryEmailTemplateInput
): EmailTemplateData => {
  const { name, email, mobile, countryIsoCode, message, source } = input;

  const subject = `${source || 'WorkDesk24'} - New Inquiry from ${name}`;
  const text = [
    `Name: ${name}`,
    `Email: ${email}`,
    `Mobile: ${mobile}`,
    `Country: ${countryIsoCode}`,
    `Message: ${message}`,
    `Source: ${source}`,
  ].join('\n');

  const html = `
    <div style="font-family: Arial, sans-serif; line-height: 1.5; color: #111827;">
      <h2 style="margin: 0 0 12px;">New Inquiry from ${name}</h2>
      <p style="margin: 0 0 8px;"><strong>Name:</strong> ${name}</p>
      <p style="margin: 0 0 8px;"><strong>Email:</strong> ${email}</p>
      <p style="margin: 0 0 8px;"><strong>Mobile:</strong> ${mobile}</p>
      <p style="margin: 0 0 8px;"><strong>Country:</strong> ${countryIsoCode}</p>
      <p style="margin: 0 0 8px;"><strong>Message:</strong> ${message}</p>
      <p style="margin: 0 0 8px;"><strong>Source:</strong> ${source}</p>
    </div>
  `;

  return { subject, text, html };
};
