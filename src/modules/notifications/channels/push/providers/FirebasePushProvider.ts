import { getFirebaseMessaging } from '../../../../../config/firebase-admin';
import { PushMessage, PushProvider, PushSendResult } from '../types/push.types';

export class FirebasePushProvider implements PushProvider {
  async send(message: PushMessage): Promise<PushSendResult> {
    try {
      const response = await getFirebaseMessaging().send({
        token: message.token,
        notification: {
          title: message.title,
          body: message.body,
        },
        data: message.data,
      });

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
