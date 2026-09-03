require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');

const { DashboardService } = require('../../src/modules/dashboard/services/dashboard.service');
const { DashboardCacheInvalidationService } = require('../../src/modules/dashboard/services/dashboard-cache-invalidation.service');

class FakeDashboardCache {
  constructor() {
    this.nowMs = 0;
    this.values = new Map();
    this.getOrSetCalls = 0;
    this.incrementCalls = [];
    this.fail = false;
  }

  advance(ms) {
    this.nowMs += ms;
  }

  read(key) {
    const row = this.values.get(key);
    if (!row) return null;
    if (row.expiresAt !== null && row.expiresAt <= this.nowMs) {
      this.values.delete(key);
      return null;
    }
    return row.value;
  }

  async get(key) {
    if (this.fail) return null;
    return this.read(key);
  }

  async set(key, value, ttlSeconds = 60) {
    if (this.fail) return false;
    this.values.set(key, { value, expiresAt: this.nowMs + ttlSeconds * 1000 });
    return true;
  }

  async delete(key) {
    return this.values.delete(key);
  }

  async exists(key) {
    return this.read(key) !== null;
  }

  async deleteMany(keys) {
    return keys.reduce((count, key) => count + (this.values.delete(key) ? 1 : 0), 0);
  }

  async increment(key, ttlSeconds = 60) {
    this.incrementCalls.push({ key, ttlSeconds });
    if (this.fail) return null;
    const next = Number(this.read(key) || 0) + 1;
    await this.set(key, next, ttlSeconds);
    return next;
  }

  async getOrSet(key, factory, ttlSeconds) {
    return this.getOrSetWithLock(key, factory, ttlSeconds);
  }

  async getOrSetWithLock(key, factory, ttlSeconds) {
    const result = await this.getOrSetWithLockResult(key, factory, ttlSeconds);
    return result.value;
  }

  async getOrSetWithLockResult(key, factory, ttlSeconds) {
    this.getOrSetCalls += 1;
    if (!this.fail) {
      const cached = this.read(key);
      if (cached !== null) return { value: cached, hit: true };
    }
    const fresh = await factory();
    if (!this.fail) await this.set(key, fresh, ttlSeconds);
    return { value: fresh, hit: false };
  }
}

function createRepository() {
  const calls = {
    aggregate: 0,
    scopes: [],
  };

  return {
    calls,
    async resolveScopedEmployeeIds(hostId, filters) {
      calls.scopes.push({ hostId, filters });
      if (filters.employeeIds || filters.teamIds) {
        return filters.employeeIds || [301, 302];
      }
      return undefined;
    },
    async getKpiCounts(scope) {
      calls.aggregate += 1;
      return {
        totalEmployees: scope.hostId,
        presentToday: 3,
        onLeaveToday: 1,
        totalVisits: 7,
        totalOrders: 5,
        totalPaymentAmount: 1234.5,
        pendingDayovers: 2,
      };
    },
    async getVisitCounts() {
      return { totalVisits: 7, completed: 6, inProgress: 1 };
    },
    async getOrderCounts() {
      return { totalOrders: 5, totalOrderAmount: 2000 };
    },
    async getPaymentCounts() {
      return { totalPayments: 4, totalPaymentAmount: 1234.5 };
    },
    async getFeedbackCounts() {
      return { totalFeedback: 2 };
    },
    async getImageCounts() {
      return { totalUploaded: 9 };
    },
    async getSummaryTrend() {
      return [{ date: '2026-09-03', present: 3, totalVisits: 7, totalOrders: 5, totalOrderAmount: 2000, totalPayments: 4, totalPaymentAmount: 1234.5, totalFeedback: 2, totalUploaded: 9 }];
    },
    async getLeaveTrend() {
      return new Map([['2026-09-03', 1]]);
    },
    async getDayoverCounts() {
      return { completed: 1, pending: 2, missing: 0 };
    },
  };
}

function createService(options = {}) {
  const cache = options.cache || new FakeDashboardCache();
  const repository = options.repository || createRepository();
  const performanceCalls = [];
  const activityCalls = [];
  const performance = {
    async getBestPerformers(params) { performanceCalls.push(['overall', params]); return [{ rank: 1, employee: { id: 1 } }]; },
    async getTopVisitPerformers(params) { performanceCalls.push(['visits', params]); return [{ rank: 1, employee: { id: 2 } }]; },
    async getTopOrderPerformers(params) { performanceCalls.push(['orders', params]); return [{ rank: 1, employee: { id: 3 } }]; },
    async getTopPaymentPerformers(params) { performanceCalls.push(['payments', params]); return [{ rank: 1, employee: { id: 4 } }]; },
  };
  const reporting = {
    async getAllActivitiesReport(payload) {
      activityCalls.push(payload);
      return { activities: [{ id: 1, module: 'ATTENDANCE' }] };
    },
  };
  const versionReader = options.versionReader || { async getOverviewVersion(hostId) { return hostId === 200 ? 2 : 1; } };
  const service = new DashboardService(
    repository,
    cache,
    performance,
    reporting,
    versionReader,
    async () => ({ timeZone: 'Asia/Kolkata' })
  );

  return { service, cache, repository, performanceCalls, activityCalls };
}

const overviewRequest = {
  filter: { date: { type: 'custom', startDate: '2026-09-03', endDate: '2026-09-03' } },
  options: { trendGranularity: 'day', topPerformersLimit: 5, activityLimit: 10, includeActivity: true },
};

test('authenticated tenant receives its own dashboard and tenant cache keys are isolated', async () => {
  const { service } = createService();

  const tenantA = await service.getOverview({ hostId: 100, requestUserId: 1, request: overviewRequest });
  const tenantB = await service.getOverview({ hostId: 200, requestUserId: 1, request: overviewRequest });

  assert.equal(tenantA.meta.hostId, 100);
  assert.equal(tenantB.meta.hostId, 200);
  assert.equal(tenantA.kpis.totalEmployees, 100);
  assert.equal(tenantB.kpis.totalEmployees, 200);
  assert.notEqual(tenantA.meta.cache.key, tenantB.meta.cache.key);
  assert.match(tenantA.meta.cache.key, /:100:/);
  assert.match(tenantB.meta.cache.key, /:200:/);
});

test('dashboard cache hit avoids database aggregation and miss stores result', async () => {
  const first = createService();
  const result = await first.service.getOverview({ hostId: 101, requestUserId: 1, request: overviewRequest });
  assert.equal(first.repository.calls.aggregate, 1);
  assert.equal(first.cache.values.size, 1);
  assert.equal(result.meta.cache.hit, false);
  assert.equal(result.meta.cache.source, 'database');

  const second = await first.service.getOverview({ hostId: 101, requestUserId: 1, request: overviewRequest });
  assert.equal(first.repository.calls.aggregate, 1);
  assert.deepEqual(second.kpis, result.kpis);
  assert.equal(second.meta.cache.hit, true);
  assert.equal(second.meta.cache.source, 'cache');
});

test('expired dashboard cache recalculates and Redis unavailable falls back to aggregation', async () => {
  const cached = createService();
  await cached.service.getOverview({ hostId: 102, requestUserId: 1, request: overviewRequest });
  cached.cache.advance(601000);
  await cached.service.getOverview({ hostId: 102, requestUserId: 1, request: overviewRequest });
  assert.equal(cached.repository.calls.aggregate, 2);

  const failing = createService();
  failing.cache.fail = true;
  const result = await failing.service.getOverview({ hostId: 103, requestUserId: 1, request: overviewRequest });
  assert.equal(result.meta.hostId, 103);
  assert.equal(result.meta.cache.hit, false);
  assert.equal(result.meta.cache.source, 'database');
  assert.equal(failing.repository.calls.aggregate, 1);
});

test('date filters generate different cache keys', async () => {
  const { service } = createService();
  const today = await service.getOverview({ hostId: 104, requestUserId: 1, request: overviewRequest });
  const yesterday = await service.getOverview({
    hostId: 104,
    requestUserId: 1,
    request: {
      ...overviewRequest,
      filter: { date: { type: 'custom', startDate: '2026-09-02', endDate: '2026-09-02' } },
    },
  });

  assert.notEqual(today.meta.cache.key, yesterday.meta.cache.key);
});

test('dashboard reuses top performer and activity services without changing existing APIs', async () => {
  const { service, performanceCalls, activityCalls } = createService();
  const result = await service.getOverview({ hostId: 105, requestUserId: 1, request: overviewRequest });

  assert.equal(performanceCalls.length, 4);
  assert.equal(activityCalls.length, 1);
  assert.deepEqual(result.performance.overall, [{ rank: 1, employee: { id: 1 } }]);
  assert.deepEqual(result.activity.items, [{ id: 1, module: 'ATTENDANCE' }]);

  const reportsRoutes = fs.readFileSync('src/routes/v1/admin/reports.routes.ts', 'utf8');
  const performanceRepository = fs.readFileSync('src/modules/ai-insights/repositories/performance-insight.repository.ts', 'utf8');
  assert.match(reportsRoutes, /reports\/getAllActivities/);
  assert.match(reportsRoutes, /reports\/getLastLocations/);
  assert.match(performanceRepository, /getBestPerformers/);
  assert.match(performanceRepository, /getTopVisitPerformers/);
});

test('business invalidation bumps only tenant dashboard overview version', async () => {
  const cache = new FakeDashboardCache();
  const invalidation = new DashboardCacheInvalidationService(cache);

  assert.equal(await invalidation.getOverviewVersion(111), 0);
  await invalidation.invalidateOverview({ hostId: 111, event: 'payment.changed', occurredAt: 1788373800 });
  assert.equal(await invalidation.getOverviewVersion(111), 1);
  assert.equal(await invalidation.getOverviewVersion(222), 0);
  assert.equal(cache.incrementCalls.length, 1);
  assert.match(cache.incrementCalls[0].key, /:dashboard:overview:version:111$/);
});