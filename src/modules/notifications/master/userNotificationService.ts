import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import notificationFacade from '../NotificationFacade';
import { SyncUserSettingsNotificationPayload, PushNotificationDeliveryResult } from './types/user-notification.types';
import { CommonUtil } from '../../../shared/utils/common.util';
import { NotificationType, NotificationAction } from '../channels/push/types/push.types';

class UserNotificationService {
  async syncUserSettings(payload: SyncUserSettingsNotificationPayload): Promise<PushNotificationDeliveryResult> {
    const fcmToken = `${payload.fcmToken || ''}`.trim();
    if (!fcmToken) {
      throw createConfiguredError('VALIDATION_ERROR', 'FCM token is required');
    }

    const notificationPayload = {
      token: fcmToken,
      data: {
        title: 'Settings Updated',
        body: 'Your settings have been updated.',
        notificationId: CommonUtil.generateUUID(),
        notificationType: NotificationType.SETTINGS,
        action: NotificationAction.REFRESH_USER_SETTINGS,
        silent: 'true',
        timestamp: DateTimeFormatUtil.getCurrentUnixTime().toString(),
      },
      android: {
        priority: "high"   // Ensures delivery even in Doze mode
      }
    };
    console.log("###################### notificationPayload:", notificationPayload);

    const sendResult = await notificationFacade.send({
      channel: 'PUSH',
      payload: notificationPayload,
    });

    if (!sendResult.success) {
      return {
        deliveryChannel: 'PUSH',
        destination: fcmToken,
        messageId: sendResult.messageId || null,
        provider: sendResult.provider || null,
        status: 'FAILED',
        failedReason: sendResult.error || 'Failed to send settings sync notification',
        sentAt: null,
      };
    }

    return {
      deliveryChannel: 'PUSH',
      destination: fcmToken,
      messageId: sendResult.messageId || null,
      provider: sendResult.provider || null,
      status: 'SENT',
      failedReason: null,
      sentAt: DateTimeFormatUtil.getCurrentUnixTime(),
    };
  }
}

export default new UserNotificationService();
