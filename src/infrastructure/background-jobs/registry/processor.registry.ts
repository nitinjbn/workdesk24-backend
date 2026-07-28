import { ProcessorRegistry } from '../managers/ProcessorRegistry';
import { createPlaceholderProcessors } from '../processors';
import {
  noopBackgroundJobLogger,
  type BackgroundJobLogger,
} from '../utils/logger.utils';

/** Registers all processors for the worker process. */
export class FrameworkProcessorRegistry {
  public constructor(
    private readonly logger: BackgroundJobLogger = noopBackgroundJobLogger,
  ) {}

  public registerAll(processorRegistry: ProcessorRegistry): void {
    processorRegistry.registerAll(createPlaceholderProcessors(this.logger));
  }
}
