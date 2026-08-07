import { registerAllSchedulers } from './schedulers';
import { redisConnection } from './config/redis.config';

async function main(): Promise<void> {
  console.log('[Scheduler] Starting registration...');

  try {
    await registerAllSchedulers();

    console.log('[Scheduler] Registration completed successfully');
  } catch (error) {
    console.error('[Scheduler] Registration failed:', error);

    process.exitCode = 1;
  } finally {
    await redisConnection.quit();
  }
}

void main();