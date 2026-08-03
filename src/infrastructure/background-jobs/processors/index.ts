import type { ProcessorDefinition } from '../interfaces/processor.interface';
import type { BackgroundJobLogger } from '../utils/logger.utils';
import { emailProcessor } from './email.processor';
import { imageProcessor } from './image.processor';
import { LocationProcessor, locationProcessor } from './location.processor';
import { notificationProcessor } from './notification.processor';
import { reportProcessor } from './report.processor';
import { SystemProcessor, systemProcessor } from './system.processor';

export {
	emailProcessor,
	imageProcessor,
	locationProcessor,
	notificationProcessor,
	reportProcessor,
	systemProcessor,
};

export function createPlaceholderProcessors(logger: BackgroundJobLogger): ReadonlyArray<ProcessorDefinition> {
	return [
		new LocationProcessor(logger),
		notificationProcessor,
		emailProcessor,
		imageProcessor,
		reportProcessor,
		new SystemProcessor(logger),
	];
}

export const placeholderProcessors: ReadonlyArray<ProcessorDefinition> = createPlaceholderProcessors({
	info: () => undefined,
	error: () => undefined,
});
