import { getFirebaseMessaging } from '../../../../../config/firebase-admin';
import { PushMessage, PushProvider, PushSendResult } from '../types/push.types';

export class FirebasePushProvider implements PushProvider {
  async send(message: PushMessage): Promise<PushSendResult> {
    try {
      const isSilent = String(message.data?.silent).toLowerCase() === 'true';

      const fcmMessage: any = {
        token: message.token,
        data: message.data,
        android: { priority: 'high' }
      };

      if (!isSilent) {
        fcmMessage.notification = {
          title: message.data?.title,
          body: message.data?.body,
        };
      }
      
      const response = await getFirebaseMessaging().send(fcmMessage);

      return {
        success: true,
        provider: 'FIREBASE',
        messageId: response,
      };
    } catch (error: any) {
      return {
        success: false,
        provider: 'FIREBASE',
        error: error?.message || 'Failed to send push notification via Firebase',
      };
    }
  }
}

export default FirebasePushProvider;
