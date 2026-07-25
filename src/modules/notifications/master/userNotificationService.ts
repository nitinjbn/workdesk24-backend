import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import notificationFacade from '../NotificationFacade';
import { SyncUserSettingsNotificationPayload, PushNotificationDeliveryResult } from './types/user-notification.types';
import { CommonUtil } from '../../../shared/utils/common.util';
import { NotificationType, NotificationAction } from '../channels/push/types/push.types';
import pushNotificationsRepository from '../repositories/push.notifications.repository';

class UserNotificationService {
  async syncUserSettings(payload: SyncUserSettingsNotificationPayload): Promise<PushNotificationDeliveryResult> {
    const { hostId, userId, deviceId } = payload;
    const fcmToken = `${payload.fcmToken || ''}`.trim();
    
    if (!hostId || !userId || !deviceId || !fcmToken) {
      //throw createConfiguredError('VALIDATION_ERROR', 'hostId, userId, deviceId and FCM token are required');
      console.warn('Missing required parameters for syncUserSettings notification:', { hostId, userId, deviceId, fcmToken });
        return {
            deliveryChannel: 'PUSH',
            notificationId: null,
            notificationLogId: null,
            destination: fcmToken,
            messageId: null,
            provider: null,
            status: 'FAILED',
            failedReason: 'Missing required parameters for syncUserSettings notification',
            sentAt: null,
        }; 
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

    const notificationLog = await pushNotificationsRepository.savePushNotification({
      hostId,
      userId,
      deviceId,
      fcmToken,
      notificationId: notificationPayload.data.notificationId,
      notificationType: NotificationType.SETTINGS,
      action: NotificationAction.REFRESH_USER_SETTINGS,
      status: sendResult.success ? 'SENT' : 'FAILED',
      providerMessageId: sendResult.messageId || null,
      provider: sendResult.provider || null,
      failureReason: sendResult.error || null,
      sentAt: sendResult.success ? DateTimeFormatUtil.getCurrentUnixTime() : null,
      payload: notificationPayload.data,
      deliveryMode: 'SILENT',
      priority: 'HIGH',
    });
    //console.log("###################### notificationLog:", notificationLog);

    if (!sendResult.success) {
      return {
        deliveryChannel: 'PUSH',
        notificationId: notificationPayload.data.notificationId,
        notificationLogId: notificationLog?.id || null,
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
      notificationId: notificationPayload.data.notificationId,
      notificationLogId: notificationLog?.id || null,
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
