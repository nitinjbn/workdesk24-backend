import emailProviderFactory from './EmailProvider';
import { buildAuthOtpEmailMessage } from './builders/auth-otp-email.builder';
import { OtpEmailPayload } from '../../types/notification.types';
import { EmailMessage, EmailSendResult } from './types/email.types';

export class EmailService {
	async send(message: EmailMessage): Promise<EmailSendResult> {
		const provider = emailProviderFactory.createProvider();
		return provider.send(message);
	}

	async sendAuthOtpEmail(payload: OtpEmailPayload): Promise<EmailSendResult> {
		const message = buildAuthOtpEmailMessage(payload);
        console.log("################ EmailService.sendAuthOtpEmail: Built email message:", message);
		return this.send(message);
	}
}

export default new EmailService();
