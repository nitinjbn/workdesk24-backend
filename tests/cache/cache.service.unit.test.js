require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { CacheService, buildTenantCacheKey } = require('../../src/shared/cache');

class FakeRedis {
  constructor() {
    this.nowMs = 0;
    this.values = new Map();
    this.fail = false;
  }

  advance(ms) {
    this.nowMs += ms;
  }

  assertAvailable() {
    if (this.fail) {
      throw new Error('Redis unavailable');
    }
  }

  isExpired(record) {
    return record.expiresAt !== null && record.expiresAt <= this.nowMs;
  }

  getRecord(key) {
    const record = this.values.get(key);
    if (!record) return null;
    if (this.isExpired(record)) {
      this.values.delete(key);
      return null;
    }
    return record;
  }

  async get(key) {
    this.assertAvailable();
    return this.getRecord(key)?.value ?? null;
  }

  async set(key, value, exMode, ttlSeconds, nxMode) {
    this.assertAvailable();
    if (nxMode === 'NX' && this.getRecord(key)) {
      return null;
    }

    this.values.set(key, {
      value,
      expiresAt: exMode === 'EX' ? this.nowMs + ttlSeconds * 1000 : null,
    });
    return 'OK';
  }

  async del(...keys) {
    this.assertAvailable();
    let count = 0;
    keys.forEach((key) => {
      if (this.values.delete(key)) count += 1;
    });
    return count;
  }

  async exists(key) {
    this.assertAvailable();
    return this.getRecord(key) ? 1 : 0;
  }

  async incr(key) {
    this.assertAvailable();
    const current = Number(this.getRecord(key)?.value || 0) + 1;
    this.values.set(key, { value: String(current), expiresAt: null });
    return current;
  }

  async expire(key, ttlSeconds) {
    this.assertAvailable();
    const record = this.getRecord(key);
    if (!record) return 0;
    record.expiresAt = this.nowMs + ttlSeconds * 1000;
    return 1;
  }

  async eval(_script, _keyCount, key, token) {
    this.assertAvailable();
    if (this.getRecord(key)?.value === token) {
      this.values.delete(key);
      return 1;
    }
    return 0;
  }
}

const delay = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

function createCache(options = {}) {
  const redis = new FakeRedis();
  const cache = new CacheService(
    {
      enabled: options.enabled ?? true,
      defaultTtl: options.defaultTtl ?? 60,
      keyPrefix: options.keyPrefix ?? 'test',
    },
    async () => redis
  );
  return { cache, redis };
}

test('cache GET hit, miss, serialization and TTL expiry', async () => {
  const { cache, redis } = createCache({ defaultTtl: 1 });

  assert.equal(await cache.get('missing'), null);
  assert.equal(await cache.set('profile:1', { id: 1, name: 'Admin' }), true);
  assert.deepEqual(await cache.get('profile:1'), { id: 1, name: 'Admin' });

  redis.advance(1001);
  assert.equal(await cache.get('profile:1'), null);
});

test('cache SET with TTL, DELETE and deleteMany', async () => {
  const { cache } = createCache();

  assert.equal(await cache.set('a', 'A', 10), true);
  assert.equal(await cache.set('b', 'B', 10), true);
  assert.equal(await cache.set('c', 'C', 10), true);
  assert.equal(await cache.exists('a'), true);
  assert.equal(await cache.delete('a'), true);
  assert.equal(await cache.exists('a'), false);
  assert.equal(await cache.deleteMany(['b', 'c']), 2);
});

test('cache getOrSet stores factory result after a miss', async () => {
  const { cache } = createCache();
  let calls = 0;

  const first = await cache.getOrSet('factory:key', async () => {
    calls += 1;
    return { value: 42 };
  }, 30);
  const second = await cache.getOrSet('factory:key', async () => {
    calls += 1;
    return { value: 99 };
  }, 30);

  assert.deepEqual(first, { value: 42 });
  assert.deepEqual(second, { value: 42 });
  assert.equal(calls, 1);
});

test('concurrent getOrSet requests use stampede protection', async () => {
  const { cache } = createCache();
  let calls = 0;

  const results = await Promise.all(Array.from({ length: 8 }, () => cache.getOrSetWithLock(
    'stampede:key',
    async () => {
      calls += 1;
      await delay(25);
      return { generated: calls };
    },
    30,
    { lockTtlSeconds: 1, waitTimeoutMs: 250, retryDelayMs: 5 }
  )));

  assert.equal(calls, 1);
  assert.deepEqual(results, Array.from({ length: 8 }, () => ({ generated: 1 })));
});

test('Redis failure falls back to factory and disabled cache does not call Redis', async () => {
  const failing = createCache();
  failing.redis.fail = true;

  const value = await failing.cache.getOrSet('fallback:key', async () => 'mysql-value', 30);
  assert.equal(value, 'mysql-value');

  const disabled = createCache({ enabled: false });
  disabled.redis.fail = true;
  assert.equal(await disabled.cache.get('disabled:key'), null);
  assert.equal(await disabled.cache.set('disabled:key', 'value'), false);
  assert.equal(await disabled.cache.getOrSet('disabled:key', async () => 'fresh'), 'fresh');
});

test('tenant-isolated cache keys are deterministic and namespaced', () => {
  const tenantA = buildTenantCacheKey({
    version: 'v1',
    module: 'attendance',
    resource: 'summary',
    tenantId: 101,
    date: '2026-09-03',
  }, 'wd24');
  const tenantARepeat = buildTenantCacheKey({
    version: 'v1',
    module: 'attendance',
    resource: 'summary',
    tenantId: 101,
    date: '2026-09-03',
  }, 'wd24');
  const tenantB = buildTenantCacheKey({
    version: 'v1',
    module: 'attendance',
    resource: 'summary',
    tenantId: 202,
    date: '2026-09-03',
  }, 'wd24');

  assert.equal(tenantA, tenantARepeat);
  assert.notEqual(tenantA, tenantB);
  assert.match(tenantA, /^wd24:v1:attendance:summary:101:date-2026-09-03$/);
});