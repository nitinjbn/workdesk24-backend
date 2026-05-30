import transporter from '../../config/email';

interface EmailOptions {
  to: string;
  subject: string;
  text: string;
  html?: string;
}

interface EmailResult {
  success: boolean;
  messageId?: string;
  error?: string;
}

interface InquiryData {
  name: string;
  email: string;
  subject: string;
  message: string;
  phone?: string;
}

class EmailService {
  static async sendEmail({ to, subject, text, html }: EmailOptions): Promise<EmailResult> {
    try {
      const mailOptions = {
        from: process.env.SMTP_FROM || process.env.SMTP_USER,
        to,
        subject,
        text,
        html: html || text,
      };

      const info = await transporter.sendMail(mailOptions);
      console.log('Email sent:', info.messageId);
      return { success: true, messageId: info.messageId };
    } catch (error: any) {
      console.error('Email sending error:', error);
      return { success: false, error: error.message };
    }
  }

  static async sendInquiryNotification(inquiry: InquiryData): Promise<EmailResult> {
    const subject = `New Inquiry: ${inquiry.subject}`;
    const text = `
      New inquiry received from ${inquiry.name}
      Email: ${inquiry.email}
      ${inquiry.phone ? `Phone: ${inquiry.phone}` : ''}
      Subject: ${inquiry.subject}
      Message: ${inquiry.message}
    `;

    const html = `
      <h2>New Inquiry Received</h2>
      <p><strong>Name:</strong> ${inquiry.name}</p>
      <p><strong>Email:</strong> ${inquiry.email}</p>
      ${inquiry.phone ? `<p><strong>Phone:</strong> ${inquiry.phone}</p>` : ''}
      <p><strong>Subject:</strong> ${inquiry.subject}</p>
      <p><strong>Message:</strong></p>
      <p>${inquiry.message}</p>
    `;

    return await this.sendEmail({
      to: process.env.ADMIN_EMAIL || process.env.SMTP_USER || '',
      subject,
      text,
      html,
    });
  }

  static async sendInquiryConfirmation(inquiry: InquiryData): Promise<EmailResult> {
    const subject = 'Thank you for your inquiry';
    const text = `
      Dear ${inquiry.name},

      Thank you for contacting us. We have received your inquiry and will respond shortly.

      Your inquiry details:
      Subject: ${inquiry.subject}

      Best regards,
      Workdesk24 Team
    `;

    return await this.sendEmail({
      to: inquiry.email,
      subject,
      text,
    });
  }
}

export default EmailService;
