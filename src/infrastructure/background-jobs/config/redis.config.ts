import IORedis, { type RedisOptions } from 'ioredis';

const DEFAULT_REDIS_PORT = 6379;

function readPort(value: string | undefined): number {
  if (value === undefined) {
    return DEFAULT_REDIS_PORT;
  }

  const port = Number(value);
  if (!Number.isInteger(port) || port < 1 || port > 65_535) {
    throw new Error('REDIS_PORT must be an integer between 1 and 65535.');
  }

  return port;
}

function readDatabase(value: string | undefined): number {
  if (value === undefined) {
    return 0;
  }

  const database = Number(value);
  if (!Number.isInteger(database) || database < 0) {
    throw new Error('REDIS_DB must be a non-negative integer.');
  }

  return database;
}

function createRedisConnection(): IORedis {
  const redisUrl = process.env.REDIS_URL;
  const options: RedisOptions = {
    // BullMQ requires this setting because it handles command retries itself.
    maxRetriesPerRequest: null,
    enableReadyCheck: true,
    lazyConnect: true,
  };

  if (redisUrl !== undefined && redisUrl.trim() !== '') {
    try {
      return new IORedis(redisUrl, options);
    } catch (error: unknown) {
      const reason = error instanceof Error ? error.message : 'unknown error';
      throw new Error(`Invalid REDIS_URL configuration: ${reason}`);
    }
  }

  return new IORedis({
    ...options,
    host: process.env.REDIS_HOST?.trim() || '127.0.0.1',
    port: readPort(process.env.REDIS_PORT),
    username: process.env.REDIS_USERNAME,
    password: process.env.REDIS_PASSWORD,
    db: readDatabase(process.env.REDIS_DB),
    tls: process.env.REDIS_TLS === 'true' ? {} : undefined,
  });
}

/** A single process-wide producer connection, configured for Railway and Redis-compatible services. */
export const redisConnection = createRedisConnection();

export default redisConnection;
