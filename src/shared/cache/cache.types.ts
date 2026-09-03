export type CacheKey = string;
export type CacheKeyPart = string | number | boolean;

export interface CacheSettings {
  enabled: boolean;
  defaultTtl: number;
  keyPrefix: string;
}

export interface CacheLockOptions {
  lockTtlSeconds?: number;
  waitTimeoutMs?: number;
  retryDelayMs?: number;
}

export interface CacheResult<T> {
  value: T;
  hit: boolean;
}

export interface TenantCacheKeyInput {
  module: CacheKeyPart;
  resource: CacheKeyPart;
  tenantId?: CacheKeyPart;
  hostId?: CacheKeyPart;
  action?: CacheKeyPart;
  version?: CacheKeyPart;
  scope?: CacheKeyPart | CacheKeyPart[];
  identifier?: CacheKeyPart | CacheKeyPart[];
  userId?: CacheKeyPart;
  teamId?: CacheKeyPart;
  date?: CacheKeyPart;
}

export interface CacheServiceContract {
  get<T>(key: CacheKey): Promise<T | null>;
  set<T>(key: CacheKey, value: T, ttlSeconds?: number): Promise<boolean>;
  delete(key: CacheKey): Promise<boolean>;
  exists(key: CacheKey): Promise<boolean>;
  deleteMany(keys: CacheKey[]): Promise<number>;
  increment(key: CacheKey, ttlSeconds?: number): Promise<number | null>;
  getOrSet<T>(key: CacheKey, factory: () => Promise<T>, ttlSeconds?: number): Promise<T>;
  getOrSetWithLock<T>(key: CacheKey, factory: () => Promise<T>, ttlSeconds?: number, lockOptions?: CacheLockOptions): Promise<T>;
  getOrSetWithLockResult<T>(key: CacheKey, factory: () => Promise<T>, ttlSeconds?: number, lockOptions?: CacheLockOptions): Promise<CacheResult<T>>;
}