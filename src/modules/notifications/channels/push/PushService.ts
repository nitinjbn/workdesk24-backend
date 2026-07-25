import pushProviderFactory from './PushProvider';
import { buildAuthOtpPushMessage } from './builders/auth-otp-push.builder';
import { OtpPushPayload } from '../../types/notification.types';
import { PushMessage, PushSendResult } from './types/push.types';

export class PushService {
  async send(message: PushMessage): Promise<PushSendResult> {
    const provider = pushProviderFactory.createProvider();
    return provider.send(message);
  }

  async sendAuthOtpPush(payload: OtpPushPayload): Promise<PushSendResult> {
    const message = buildAuthOtpPushMessage(payload);
    return this.send(message);
  }
}

export default new PushService();
