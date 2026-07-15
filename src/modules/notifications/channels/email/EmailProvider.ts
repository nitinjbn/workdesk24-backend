import { CONFIG } from '../../../../config/constants';
import { EmailProvider } from './types/email.types';
import { SESProvider } from './providers/SESProvider';

class EmailProviderFactory {
	createProvider(): EmailProvider {
		const provider = CONFIG.NOTIFICATIONS.EMAIL.PROVIDER;

		if (provider === 'SES') {
			return new SESProvider();
		}

		throw new Error(`Unsupported email provider: ${provider}`);
	}
}

export default new EmailProviderFactory();
