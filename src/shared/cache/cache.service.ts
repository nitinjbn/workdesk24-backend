import type IORedis from 'ioredis';
import cacheConfig from '../../config/cache';
import { logger } from '../../config/database';
import { ensureRedisConnectionReady } from '../../infrastructure/background-jobs/config/redis.config';
import type { CacheKey, CacheLockOptions, CacheResult, CacheServiceContract, CacheSettings } from './cache.types';
import { CacheKeyUtil } from './cache-key.util';

const DEFAULT_LOCK_TTL_SECONDS = 10;
const DEFAULT_LOCK_WAIT_TIMEOUT_MS = 2000;
const DEFAULT_LOCK_RETRY_DELAY_MS = 100;

type RedisCommandClient = Pick<IORedis, 'get' | 'set' | 'del' | 'exists' | 'incr' | 'expire' | 'eval'>;

interface ResolvedCacheLockOptions {
  lockTtlSeconds: number;
  waitTimeoutMs: number;
  retryDelayMs: number;
}

interface CacheLockWaitResult<T> {
  cachedValue: T | null;
  acquiredLock: boolean;
}

export class CacheService implements CacheServiceContract {
  public constructor(
    private readonly settings: CacheSettings = cacheConfig,
    private readonly connectionFactory: () => Promise<RedisCommandClient> = ensureRedisConnectionReady,
  ) {}

  public async get<T>(key: CacheKey): Promise<T | null> {
    if (!this.settings.enabled) {
      return null;
    }

    try {
      const client = await this.connectionFactory();
      const value = await client.get(this.buildKey(key));

      if (value === null) {
        return null;
      }

      return JSON.parse(value) as T;
    } catch (error: unknown) {
      this.logCacheFailure('get', key, error);
      return null;
    }
  }

  public async set<T>(key: CacheKey, value: T, ttlSeconds?: number): Promise<boolean> {
    if (!this.settings.enabled) {
      return false;
    }

    try {
      const ttl = this.resolveTtl(ttlSeconds);
      const client = await this.connectionFactory();
      const result = await client.set(this.buildKey(key), JSON.stringify(value), 'EX', ttl);
      return result === 'OK';
    } catch (error: unknown) {
      this.logCacheFailure('set', key, error);
      return false;
    }
  }

  public async delete(key: CacheKey): Promise<boolean> {
    if (!this.settings.enabled) {
      return false;
    }

    try {
      const client = await this.connectionFactory();
      const deletedCount = await client.del(this.buildKey(key));
      return deletedCount > 0;
    } catch (error: unknown) {
      this.logCacheFailure('delete', key, error);
      return false;
    }
  }

  public async exists(key: CacheKey): Promise<boolean> {
    if (!this.settings.enabled) {
      return false;
    }

    try {
      const client = await this.connectionFactory();
      const existsCount = await client.exists(this.buildKey(key));
      return existsCount > 0;
    } catch (error: unknown) {
      this.logCacheFailure('exists', key, error);
      return false;
    }
  }

  public async deleteMany(keys: CacheKey[]): Promise<number> {
    if (!this.settings.enabled || keys.length === 0) {
      return 0;
    }

    try {
      const client = await this.connectionFactory();
      return client.del(...keys.map((key) => this.buildKey(key)));
    } catch (error: unknown) {
      this.logCacheFailure('deleteMany', keys.join(','), error);
      return 0;
    }
  }

  public async increment(key: CacheKey, ttlSeconds?: number): Promise<number | null> {
    if (!this.settings.enabled) {
      return null;
    }

    try {
      const client = await this.connectionFactory();
      const cacheKey = this.buildKey(key);
      const value = await client.incr(cacheKey);
      await client.expire(cacheKey, this.resolveTtl(ttlSeconds));
      return value;
    } catch (error: unknown) {
      this.logCacheFailure('increment', key, error);
      return null;
    }
  }

  public async getOrSet<T>(key: CacheKey, factory: () => Promise<T>, ttlSeconds?: number): Promise<T> {
    return this.getOrSetWithLock(key, factory, ttlSeconds);
  }

  public async getOrSetWithLock<T>(
    key: CacheKey,
    factory: () => Promise<T>,
    ttlSeconds?: number,
    lockOptions?: CacheLockOptions,
  ): Promise<T> {
    const result = await this.getOrSetWithLockResult(key, factory, ttlSeconds, lockOptions);
    return result.value;
  }

  public async getOrSetWithLockResult<T>(
    key: CacheKey,
    factory: () => Promise<T>,
    ttlSeconds?: number,
    lockOptions?: CacheLockOptions,
  ): Promise<CacheResult<T>> {
    const cachedValue = await this.get<T>(key);
    if (cachedValue !== null) {
      return { value: cachedValue, hit: true };
    }

    if (!this.settings.enabled) {
      return { value: await factory(), hit: false };
    }

    let client: RedisCommandClient;
    const cacheKey = this.buildKey(key);
    const lockKey = this.buildLockKey(cacheKey);
    const lockToken = this.createLockToken();
    const resolvedLockOptions = this.resolveLockOptions(lockOptions);

    try {
      client = await this.connectionFactory();
    } catch (error: unknown) {
      this.logCacheFailure('getOrSetWithLock.connection', key, error);
      return { value: await factory(), hit: false };
    }

    const acquiredLock = await this.acquireLock(client, lockKey, lockToken, resolvedLockOptions.lockTtlSeconds, key);
    if (acquiredLock) {
      try {
        const valueAfterLock = await this.readCacheValue<T>(client, cacheKey);
        if (valueAfterLock !== null) {
          return { value: valueAfterLock, hit: true };
        }

        const freshValue = await factory();
        await this.writeCacheValue(client, cacheKey, freshValue, ttlSeconds, key);
        return { value: freshValue, hit: false };
      } finally {
        await this.releaseLock(client, lockKey, lockToken, key);
      }
    }

    const waitResult = await this.waitForCachedValueOrLock<T>(
      client,
      cacheKey,
      lockKey,
      lockToken,
      key,
      resolvedLockOptions,
    );

    if (waitResult.cachedValue !== null) {
      return { value: waitResult.cachedValue, hit: true };
    }

    if (waitResult.acquiredLock) {
      try {
        const valueAfterLock = await this.readCacheValue<T>(client, cacheKey);
        if (valueAfterLock !== null) {
          return { value: valueAfterLock, hit: true };
        }

        const freshValue = await factory();
        await this.writeCacheValue(client, cacheKey, freshValue, ttlSeconds, key);
        return { value: freshValue, hit: false };
      } finally {
        await this.releaseLock(client, lockKey, lockToken, key);
      }
    }

    const freshValue = await factory();
    await this.writeCacheValue(client, cacheKey, freshValue, ttlSeconds, key);
    return { value: freshValue, hit: false };
  }

  private async readCacheValue<T>(client: RedisCommandClient, cacheKey: string): Promise<T | null> {
    const value = await client.get(cacheKey);

    if (value === null) {
      return null;
    }

    return JSON.parse(value) as T;
  }

  private async writeCacheValue<T>(client: RedisCommandClient, cacheKey: string, value: T, ttlSeconds: number | undefined, originalKey: string): Promise<boolean> {
    try {
      const result = await client.set(cacheKey, JSON.stringify(value), 'EX', this.resolveTtl(ttlSeconds));
      return result === 'OK';
    } catch (error: unknown) {
      this.logCacheFailure('set', originalKey, error);
      return false;
    }
  }

  private async acquireLock(
    client: RedisCommandClient,
    lockKey: string,
    lockToken: string,
    lockTtlSeconds: number,
    originalKey: string,
  ): Promise<boolean> {
    try {
      const result = await client.set(lockKey, lockToken, 'EX', lockTtlSeconds, 'NX');
      return result === 'OK';
    } catch (error: unknown) {
      this.logCacheFailure('lock.acquire', originalKey, error);
      return false;
    }
  }

  private async releaseLock(client: RedisCommandClient, lockKey: string, lockToken: string, originalKey: string): Promise<void> {
    try {
      await client.eval(
        "if redis.call('get', KEYS[1]) == ARGV[1] then return redis.call('del', KEYS[1]) else return 0 end",
        1,
        lockKey,
        lockToken,
      );
    } catch (error: unknown) {
      this.logCacheFailure('lock.release', originalKey, error);
    }
  }

  private async waitForCachedValueOrLock<T>(
    client: RedisCommandClient,
    cacheKey: string,
    lockKey: string,
    lockToken: string,
    originalKey: string,
    lockOptions: ResolvedCacheLockOptions,
  ): Promise<CacheLockWaitResult<T>> {
    const startedAt = Date.now();
    const waitDeadlineMs = Math.max(
      lockOptions.waitTimeoutMs,
      (lockOptions.lockTtlSeconds * 1000) + lockOptions.retryDelayMs,
    );

    while (Date.now() - startedAt < waitDeadlineMs) {
      await this.delay(lockOptions.retryDelayMs);

      try {
        const value = await this.readCacheValue<T>(client, cacheKey);
        if (value !== null) {
          return {
            cachedValue: value,
            acquiredLock: false,
          };
        }

        const acquiredLock = await this.acquireLock(
          client,
          lockKey,
          lockToken,
          lockOptions.lockTtlSeconds,
          originalKey,
        );

        if (acquiredLock) {
          return {
            cachedValue: null,
            acquiredLock: true,
          };
        }
      } catch (error: unknown) {
        this.logCacheFailure('lock.wait', originalKey, error);
        return {
          cachedValue: null,
          acquiredLock: false,
        };
      }
    }

    return {
      cachedValue: null,
      acquiredLock: false,
    };
  }

  private buildLockKey(cacheKey: string): string {
    return `${cacheKey}:lock`;
  }

  private createLockToken(): string {
    return `${process.pid}:${Date.now()}:${Math.random().toString(36).slice(2)}`;
  }

  private resolveLockOptions(lockOptions?: CacheLockOptions): ResolvedCacheLockOptions {
    return {
      lockTtlSeconds: this.resolvePositiveInteger(lockOptions?.lockTtlSeconds, DEFAULT_LOCK_TTL_SECONDS),
      waitTimeoutMs: this.resolvePositiveInteger(lockOptions?.waitTimeoutMs, DEFAULT_LOCK_WAIT_TIMEOUT_MS),
      retryDelayMs: this.resolvePositiveInteger(lockOptions?.retryDelayMs, DEFAULT_LOCK_RETRY_DELAY_MS),
    };
  }

  private resolvePositiveInteger(value: number | undefined, defaultValue: number): number {
    if (value === undefined || !Number.isInteger(value) || value <= 0) {
      return defaultValue;
    }

    return value;
  }

  private delay(milliseconds: number): Promise<void> {
    return new Promise((resolve) => {
      setTimeout(resolve, milliseconds);
    });
  }

  private buildKey(key: CacheKey): string {
    const normalizedKey = key.trim();
    if (CacheKeyUtil.hasConfiguredPrefix(normalizedKey, this.settings.keyPrefix)) {
      return normalizedKey;
    }

    return CacheKeyUtil.withPrefix([normalizedKey], this.settings.keyPrefix);
  }

  private resolveTtl(ttlSeconds?: number): number {
    if (ttlSeconds === undefined || !Number.isInteger(ttlSeconds) || ttlSeconds <= 0) {
      return this.settings.defaultTtl;
    }

    return ttlSeconds;
  }

  private logCacheFailure(operation: string, key: string, error: unknown): void {
    logger.warn('Cache operation failed.', {
      operation,
      key,
      error: error instanceof Error ? error.message : String(error),
    });
  }
}

export const cache = new CacheService();
export default cache;