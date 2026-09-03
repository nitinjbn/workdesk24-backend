require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { DashboardOverviewRepository } = require('../../src/modules/dashboard/repositories/dashboard-overview.repository');

function createRange(label) {
  return {
    preset: label,
    startDate: label === 'custom' ? '2026-09-01' : '2026-09-03',
    endDate: label === 'custom' ? '2026-09-02' : '2026-09-03',
    startUnix: label === 'custom' ? 1788192000 : 1788364800,
    endUnix: label === 'custom' ? 1788364799 : 1788451199,
    startDateTime: '2026-09-01T00:00:00.000Z',
    endDateTime: '2026-09-02T23:59:59.000Z',
    timezone: 'Asia/Kolkata',
  };
}

function createScope() {
  return {
    hostId: 123,
    range: createRange('custom'),
    todayRange: createRange('today'),
    filters: {},
    granularity: 'day',
  };
}

test('KPI counts use selected dashboard range instead of today range', async () => {
  const repository = new DashboardOverviewRepository();
  const ranges = [];

  repository.getTotalEmployees = async () => 10;
  repository.getPresentCount = async (_hostId, range) => { ranges.push(['present', range]); return 4; };
  repository.getOnLeaveCount = async (_hostId, range) => { ranges.push(['leave', range]); return 1; };
  repository.getVisitCounts = async () => ({ totalVisits: 7, completed: 6, inProgress: 1 });
  repository.getOrderCounts = async () => ({ totalOrders: 5, totalOrderAmount: 100 });
  repository.getPaymentCounts = async () => ({ totalPayments: 3, totalPaymentAmount: 90 });
  repository.getPendingDayovers = async (_hostId, range) => { ranges.push(['pendingDayover', range]); return 2; };

  const result = await repository.getKpiCounts(createScope());

  assert.equal(result.presentToday, 4);
  assert.equal(result.onLeaveToday, 1);
  assert.equal(result.pendingDayovers, 2);
  assert.deepEqual(ranges.map(([name, range]) => [name, range.startDate, range.endDate]), [
    ['present', '2026-09-01', '2026-09-02'],
    ['leave', '2026-09-01', '2026-09-02'],
    ['pendingDayover', '2026-09-01', '2026-09-02'],
  ]);
});

test('dayover counts use selected dashboard range instead of today range', async () => {
  const repository = new DashboardOverviewRepository();
  const ranges = [];

  repository.getCompletedDayovers = async (_hostId, range) => { ranges.push(['completed', range]); return 3; };
  repository.getPendingDayovers = async (_hostId, range) => { ranges.push(['pending', range]); return 2; };

  const result = await repository.getDayoverCounts(createScope(), 10, 1);

  assert.deepEqual(result, { completed: 3, pending: 2, missing: 4 });
  assert.deepEqual(ranges.map(([name, range]) => [name, range.startDate, range.endDate]), [
    ['completed', '2026-09-01', '2026-09-02'],
    ['pending', '2026-09-01', '2026-09-02'],
  ]);
});