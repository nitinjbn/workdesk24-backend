import { SESClient, SendEmailCommand } from '@aws-sdk/client-ses';
import { CONFIG } from '../../../../../config/constants';
import { EmailMessage, EmailProvider, EmailSendResult } from '../types/email.types';

export class SESProvider implements EmailProvider {
	private client = new SESClient({
		region: CONFIG.NOTIFICATIONS.EMAIL.SES.REGION,
		credentials: CONFIG.NOTIFICATIONS.EMAIL.SES.ACCESS_KEY_ID && CONFIG.NOTIFICATIONS.EMAIL.SES.SECRET_ACCESS_KEY
			? {
				accessKeyId: CONFIG.NOTIFICATIONS.EMAIL.SES.ACCESS_KEY_ID,
				secretAccessKey: CONFIG.NOTIFICATIONS.EMAIL.SES.SECRET_ACCESS_KEY,
				...(CONFIG.NOTIFICATIONS.EMAIL.SES.SESSION_TOKEN
					? { sessionToken: CONFIG.NOTIFICATIONS.EMAIL.SES.SESSION_TOKEN }
					: {}),
			}
			: undefined,
	});

	async send(message: EmailMessage): Promise<EmailSendResult> {
		try {
            console.log("Obj", {
		region: CONFIG.NOTIFICATIONS.EMAIL.SES.REGION,
		credentials: CONFIG.NOTIFICATIONS.EMAIL.SES.ACCESS_KEY_ID && CONFIG.NOTIFICATIONS.EMAIL.SES.SECRET_ACCESS_KEY
			? {
				accessKeyId: CONFIG.NOTIFICATIONS.EMAIL.SES.ACCESS_KEY_ID,
				secretAccessKey: CONFIG.NOTIFICATIONS.EMAIL.SES.SECRET_ACCESS_KEY,
				...(CONFIG.NOTIFICATIONS.EMAIL.SES.SESSION_TOKEN
					? { sessionToken: CONFIG.NOTIFICATIONS.EMAIL.SES.SESSION_TOKEN }
					: {}),
			}
			: undefined,
	});
			const fromAddress = message.from?.email || CONFIG.NOTIFICATIONS.EMAIL.FROM_ADDRESS;
			const fromName = message.from?.name || CONFIG.NOTIFICATIONS.EMAIL.FROM_NAME;
			const source = fromName ? `${fromName} <${fromAddress}>` : fromAddress;
			const toAddresses = Array.isArray(message.to) ? message.to : [message.to];

			const command = new SendEmailCommand({
				Source: source,
				Destination: {
					ToAddresses: toAddresses,
				},
				Message: {
					Subject: {
						Data: message.subject,
						Charset: 'UTF-8',
					},
					Body: {
						Text: {
							Data: message.text,
							Charset: 'UTF-8',
						},
						Html: {
							Data: message.html || message.text,
							Charset: 'UTF-8',
						},
					},
				},
				ReplyToAddresses: message.replyTo ? [message.replyTo] : undefined,
			});

			const response = await this.client.send(command);

			return {
				success: true,
				provider: 'SES',
				messageId: response.MessageId,
			};
		} catch (error: any) {
			return {
				success: false,
				provider: 'SES',
				error: error?.message || 'Failed to send email via SES',
			};
		}
	}
}

export default SESProvider;
