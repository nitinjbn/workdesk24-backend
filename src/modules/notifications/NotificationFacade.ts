import emailService from './channels/email/EmailService';
import pushService from './channels/push/PushService';
import { NotificationRequest, NotificationResult, OtpEmailPayload, OtpPushPayload } from './types/notification.types';

class NotificationFacade {
	async send(request: NotificationRequest): Promise<NotificationResult> {
		switch (request.channel) {
			case 'EMAIL':
				return emailService.send(request.payload as any);
			case 'SMS':
					return {
						success: false,
						error: `${request.channel} channel is not implemented yet`,
					};
				case 'PUSH':
					return pushService.send(request.payload as any);
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
        //console.log("################ NotificationFacade.sendAuthOtpEmail called with payload:", payload);
		return emailService.sendAuthOtpEmail(payload);
	}

	async sendAuthOtpPush(payload: OtpPushPayload): Promise<NotificationResult> {
		return pushService.sendAuthOtpPush(payload);
	}
}

export default new NotificationFacade();
