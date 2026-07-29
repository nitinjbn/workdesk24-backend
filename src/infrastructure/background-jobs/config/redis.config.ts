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
let activeRedisConnection = createRedisConnection();

export const redisConnection = activeRedisConnection;

function waitForReady(connection: IORedis): Promise<void> {
  return new Promise<void>((resolve, reject) => {
    const handleReady = (): void => {
      cleanup();
      resolve();
    };

    const handleError = (error: Error): void => {
      cleanup();
      reject(error);
    };

    const cleanup = (): void => {
      connection.off('ready', handleReady);
      connection.off('error', handleError);
    };

    connection.on('ready', handleReady);
    connection.on('error', handleError);
  });
}

/**
 * Returns a usable Redis connection instance for BullMQ producers.
 * If the previous connection was fully closed, a new one is created.
 */
export function getRedisConnection(): IORedis {
  if (activeRedisConnection.status === 'end') {
    activeRedisConnection = createRedisConnection();
  }

  return activeRedisConnection;
}

/** Ensures the producer Redis connection is ready before queue commands are issued. */
export async function ensureRedisConnectionReady(): Promise<IORedis> {
  const connection = getRedisConnection();

  if (connection.status === 'ready') {
    return connection;
  }

  if (connection.status === 'connecting' || connection.status === 'connect' || connection.status === 'reconnecting') {
    await waitForReady(connection);
    return connection;
  }

  if (connection.status === 'wait') {
    await connection.connect();
    return connection;
  }

  if (connection.status === 'close') {
    const recoveredConnection = getRedisConnection();
    if (recoveredConnection.status === 'wait') {
      await recoveredConnection.connect();
    } else if (recoveredConnection.status !== 'ready') {
      await waitForReady(recoveredConnection);
    }

    return recoveredConnection;
  }

  return connection;
}

export function getRedisConnectionStatus(): string {
  return getRedisConnection().status;
}

export default redisConnection;
