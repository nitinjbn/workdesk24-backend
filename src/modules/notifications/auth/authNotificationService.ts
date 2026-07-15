import { EmailUtil } from '../../../shared/utils/email.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { CONFIG } from '../../../config/constants';
import notificationFacade from '../NotificationFacade';
import { SendOtpNotificationPayload } from './types/auth-notification.types';

class AuthNotificationService {
	async sendOtpEmail(payload: SendOtpNotificationPayload): Promise<{ messageId?: string; provider?: string }> {
		console.log("################ AuthNotificationService.sendOtpEmail called with payload:", payload);
        const validated = await EmailUtil.validate(payload.email, {
			checkMx: true,
			checkDisposable: true,
		});
        console.log("################ AuthNotificationService.sendOtpEmail: Email validation result:", validated);

		if (!validated.isValid || !validated.email) {
			throw createConfiguredError('INVALID_EMAIL', validated.error || 'Invalid email address', 400, 'VALIDATION_ERROR');
		}

		const otpCode = `${payload.otpCode || ''}`.trim();
		if (!otpCode) {
			throw createConfiguredError('VALIDATION_ERROR', 'OTP code is required');
		}

		if (otpCode.length !== CONFIG.NOTIFICATIONS.AUTH_OTP.CODE_LENGTH) {
			throw createConfiguredError(
				'VALIDATION_ERROR',
				`OTP code must be ${CONFIG.NOTIFICATIONS.AUTH_OTP.CODE_LENGTH} digits`
			);
		}

		const sendResult = await notificationFacade.sendAuthOtpEmail({
			to: validated.email,
			otpCode,
			appName: payload.appName || CONFIG.NOTIFICATIONS.AUTH_OTP.APP_NAME,
			purpose: payload.purpose || CONFIG.NOTIFICATIONS.AUTH_OTP.PURPOSE,
			expiryMinutes: payload.expiryMinutes || CONFIG.NOTIFICATIONS.AUTH_OTP.EXPIRY_MINUTES,
		});

		if (!sendResult.success) {
			throw createConfiguredError('FAILED_TO_SEND_OTP', sendResult.error || 'Failed to send OTP email', 500, 'INTERNAL_SERVER_ERROR');
		}

		return {
			messageId: sendResult.messageId,
			provider: sendResult.provider,
		};
	}
}

export default new AuthNotificationService();
