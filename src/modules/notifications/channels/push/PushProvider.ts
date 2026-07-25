import { CONFIG } from '../../../../config/constants';
import { PushProvider } from './types/push.types';
import { FirebasePushProvider } from './providers/FirebasePushProvider';

class PushProviderFactory {
  createProvider(): PushProvider {
    const provider = CONFIG.NOTIFICATIONS.PUSH.PROVIDER;

    if (provider === 'FIREBASE') {
      return new FirebasePushProvider();
    }

    throw new Error(`Unsupported push provider: ${provider}`);
  }
}

export default new PushProviderFactory();
