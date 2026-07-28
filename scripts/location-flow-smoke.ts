import { redisConnection } from '../src/infrastructure/background-jobs/config/redis.config';
import { runLocationFlowExample } from '../src/infrastructure/background-jobs/examples/location-flow.example';
import type { BackgroundJobLogger } from '../src/infrastructure/background-jobs/utils/logger.utils';

const logger: BackgroundJobLogger = {
  info(message, context) {
    process.stdout.write(`[INFO] ${message} ${JSON.stringify(context ?? {})}\n`);
  },
  error(message, error, context) {
    const normalized = error instanceof Error ? error.message : String(error);
    process.stdout.write(`[ERROR] ${message} ${JSON.stringify({ ...(context ?? {}), error: normalized })}\n`);
  },
};

async function run(): Promise<void> {
  await runLocationFlowExample(
    {
      attendanceId: 'att-demo-003',
      latitude: 28.6139,
      longitude: 77.209,
      requestedAt: new Date().toISOString(),
    },
    {
      redisConnection,
      logger,
      timeoutMs: 15_000,
    },
  );

  await redisConnection.quit();
  process.stdout.write('FLOW_OK\n');
}

void run().catch(async (error: unknown) => {
  process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
  try {
    await redisConnection.quit();
  } catch {
    redisConnection.disconnect();
  }
  process.exit(1);
});
