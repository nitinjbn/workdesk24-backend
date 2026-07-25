import { EmailUtil } from '../../../shared/utils/email.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { CONFIG } from '../../../config/constants';
import notificationFacade from '../NotificationFacade';
import { SendOtpNotificationPayload, SendOtpPushNotificationPayload } from './types/auth-notification.types';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';
import { CommonUtil } from '../../../shared/utils/common.util';
import { NotificationType, NotificationAction } from '../channels/push/types/push.types';

class AuthNotificationService {
	async sendOtpEmail(payload: SendOtpNotificationPayload): Promise<{ deliveryChannel: "EMAIL", destination: string; messageId?: string; provider?: string; status?: string | null; failedReason?: string | null , sentAt?: number | null }> {
		//console.log("################ AuthNotificationService.sendOtpEmail called with payload:", payload);
        const validated = await EmailUtil.validate(payload.email, {
			checkMx: true,
			checkDisposable: true,
		});
        //console.log("################ AuthNotificationService.sendOtpEmail: Email validation result:", validated);

		if (!validated.isValid || !validated.email) {
			throw createConfiguredError('INVALID_EMAIL', validated.error || 'Invalid email address', 400, 'VALIDATION_ERROR');
		}

		const otpCode = `${payload.otpCode || ''}`.trim();
		if (!otpCode) {
			throw createConfiguredError('VALIDATION_ERROR', 'OTP code is required');
		}

		if (otpCode.length !== CONFIG.OTP.AUTH.CODE_LENGTH) {
			throw createConfiguredError(
				'VALIDATION_ERROR',
				`OTP code must be ${CONFIG.OTP.AUTH.CODE_LENGTH} digits`
			);
		}

		const sendResult = await notificationFacade.sendAuthOtpEmail({
			to: validated.email,
			otpCode,
			appName: payload.appName || CONFIG.APP_CONFIG.NAME,
			purpose: payload.purpose || CONFIG.OTP.AUTH.LABEL,
			expiryMinutes: payload.expiryMinutes || CONFIG.OTP.AUTH.EXPIRY_MINUTES,
		});

		if (!sendResult.success) {
			return { 
				deliveryChannel: "EMAIL",
				destination: validated.email,
				messageId: sendResult.messageId || null,
				provider: sendResult.provider || null,
				status: "FAILED",
				failedReason: sendResult.error || 'Failed to send OTP email',
				sentAt: null
			};
			//throw createConfiguredError('FAILED_TO_SEND_OTP', sendResult.error || 'Failed to send OTP email', 500, 'INTERNAL_SERVER_ERROR');
		}

		return {
			deliveryChannel: "EMAIL",
			destination: validated.email,
			messageId: sendResult.messageId,
			provider: sendResult.provider,
			status: "SENT",
			sentAt: DateTimeFormatUtil.getCurrentUnixTime(),
		};
	}

	async sendOtpPushNotification(payload: SendOtpPushNotificationPayload): Promise<{ deliveryChannel: "PUSH", destination: string; messageId?: string; provider?: string, status?: string | null; failedReason?: string | null, sentAt?: number | null }> {
		const fcmToken = `${payload.fcmToken || ''}`.trim();
		if (!fcmToken) {
			throw createConfiguredError('VALIDATION_ERROR', 'FCM token is required');
		}

		const otpCode = `${payload.otpCode || ''}`.trim();
		if (!otpCode) {
			throw createConfiguredError('VALIDATION_ERROR', 'OTP code is required');
		}

		if (otpCode.length !== CONFIG.OTP.AUTH.CODE_LENGTH) {
			throw createConfiguredError(
				'VALIDATION_ERROR',
				`OTP code must be ${CONFIG.OTP.AUTH.CODE_LENGTH} digits`
			);
		}

		const notificationPayload = {
			token: fcmToken,
			data: {
				notificationId: CommonUtil.generateUUID(),
				notificationType: NotificationType.AUTH_OTP,
				action: NotificationAction.VERIFY_OTP,
				otpCode,
				appName: payload.appName || CONFIG.APP_CONFIG.NAME,
				purpose: payload.purpose || CONFIG.OTP.AUTH.LABEL,
				expiryMinutes: (payload.expiryMinutes || CONFIG.OTP.AUTH.EXPIRY_MINUTES).toString(),
				allowAutoFill: String(!!(CONFIG.OTP.AUTH.ALLOW_AUTO_FILL || false)), // This can be used by the client app to determine if it should auto-fill the OTP
				timestamp: DateTimeFormatUtil.getCurrentUnixTime().toString(),
			}
		};

		const sendResult = await notificationFacade.sendAuthOtpPush(notificationPayload);

		if (!sendResult.success) {
			return {
				deliveryChannel: "PUSH",
				destination: fcmToken,
				messageId: sendResult.messageId || null,
				provider: sendResult.provider || null,
				status: "FAILED",
				failedReason: sendResult.error || 'Failed to send OTP push notification',
				sentAt: null
			};
			//throw createConfiguredError('FAILED_TO_SEND_OTP', sendResult.error || 'Failed to send OTP push notification', 500, 'INTERNAL_SERVER_ERROR');
		}

		return {
			deliveryChannel: "PUSH",
			destination: fcmToken,
			messageId: sendResult.messageId || null,
			provider: sendResult.provider || null,
			status: "SENT",
			failedReason: null,
			sentAt: DateTimeFormatUtil.getCurrentUnixTime()
		};
	}
}

export default new AuthNotificationService();
