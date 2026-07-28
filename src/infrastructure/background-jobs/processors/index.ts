import type { ProcessorDefinition } from '../interfaces/processor.interface';
import type { BackgroundJobLogger } from '../utils/logger.utils';
import { emailProcessor } from './email.processor';
import { imageProcessor } from './image.processor';
import { LocationProcessor, locationProcessor } from './location.processor';
import { notificationProcessor } from './notification.processor';
import { reportProcessor } from './report.processor';

export {
	emailProcessor,
	imageProcessor,
	locationProcessor,
	notificationProcessor,
	reportProcessor,
};

export function createPlaceholderProcessors(logger: BackgroundJobLogger): ReadonlyArray<ProcessorDefinition> {
	return [
		new LocationProcessor(logger),
		notificationProcessor,
		emailProcessor,
		imageProcessor,
		reportProcessor,
	];
}

export const placeholderProcessors: ReadonlyArray<ProcessorDefinition> = createPlaceholderProcessors({
	info: () => undefined,
	error: () => undefined,
});
