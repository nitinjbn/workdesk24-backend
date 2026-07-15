import emailService from './channels/email/EmailService';
import { NotificationRequest, NotificationResult, OtpEmailPayload } from './types/notification.types';

class NotificationFacade {
	async send(request: NotificationRequest): Promise<NotificationResult> {
		switch (request.channel) {
			case 'EMAIL':
				return emailService.send(request.payload as any);
			case 'SMS':
			case 'PUSH':
			case 'WHATSAPP':
				return {
					success: false,
					error: `${request.channel} channel is not implemented yet`,
				};
			default:
				return {
					success: false,
					error: 'Unsupported notification channel',
				};
		}
	}

	async sendAuthOtpEmail(payload: OtpEmailPayload): Promise<NotificationResult> {
        console.log("################ NotificationFacade.sendAuthOtpEmail called with payload:", payload);
		return emailService.sendAuthOtpEmail(payload);
	}
}

export default new NotificationFacade();
