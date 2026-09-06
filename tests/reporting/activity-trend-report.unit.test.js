require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const moment = require('moment-timezone');

const db = require('../../src/models').default;
const activityTrendRepositoryModule = require('../../src/modules/reporting/repositories/activity-trend-report.repository');
const hostSettingsUtil = require('../../src/shared/utils/host-settings.util');
const reportService = require('../../src/modules/reporting/services/report.service').default;

const { ActivityTrendReportRepository } = activityTrendRepositoryModule;
const activityTrendRepository = activityTrendRepositoryModule.default;

const HOST_TIMEZONE = 'Asia/Kolkata';
const HOST_DATE_TIME_SETTINGS = {
  timeZone: HOST_TIMEZONE,
  dateTimeFormat: 'DD-MMM-YYYY hh:mm A',
  dateFormat: 'DD-MMM-YYYY',
  timeFormat: 'hh:mm A',
};

function dayStartUnix(date) {
  return moment.tz(date, 'YYYY-MM-DD', HOST_TIMEZONE).startOf('day').unix();
}

function dayEndUnix(date) {
  return moment.tz(date, 'YYYY-MM-DD', HOST_TIMEZONE).endOf('day').unix();
}

function stubHostSettings(t, settings = HOST_DATE_TIME_SETTINGS) {
  const original = hostSettingsUtil.getHostDateTimeSettings;
  hostSettingsUtil.getHostDateTimeSettings = async () => settings;
  t.after(() => {
    hostSettingsUtil.getHostDateTimeSettings = original;
  });
}

function stubRepositoryRows(t, rows) {
  const original = activityTrendRepository.getActivityTrendReport;
  const captured = [];
  activityTrendRepository.getActivityTrendReport = async (params) => {
    captured.push(params);
    return rows;
  };
  t.after(() => {
    activityTrendRepository.getActivityTrendReport = original;
  });
  return captured;
}

test('repository aggregates wd_user_daily_summary per day for all host users', async (t) => {
  const repository = new ActivityTrendReportRepository();
  const originalQuery = db.sequelize.query;
  const calls = [];

  db.sequelize.query = async (sql, options) => {
    calls.push({ sql, options });
    return [
      {
        reportDate: dayStartUnix('2026-09-01'),
        attendance: '2',
        visits: '5',
        orders: '3',
        payments: '1',
      },
    ];
  };
  t.after(() => {
    db.sequelize.query = originalQuery;
  });

  const fromDateUnix = dayStartUnix('2026-08-31');
  const tillDateUnix = dayEndUnix('2026-09-06');
  const rows = await repository.getActivityTrendReport({ hostId: 42, fromDateUnix, tillDateUnix });

  assert.equal(calls.length, 1);
  const { sql, options } = calls[0];
  assert.match(sql, /FROM wd_user_daily_summary/);
  assert.match(sql, /GROUP BY reportDate/);
  assert.match(sql, /ORDER BY reportDate ASC/);
  assert.match(
    sql,
    /COUNT\(DISTINCT CASE WHEN attendanceStatus = 'Present' THEN userId END\) AS attendance/
  );
  assert.match(sql, /COALESCE\(SUM\(totalVisits\), 0\) AS visits/);
  assert.match(sql, /COALESCE\(SUM\(totalOrders\), 0\) AS orders/);
  assert.match(sql, /COALESCE\(SUM\(totalPayments\), 0\) AS payments/);
  assert.doesNotMatch(sql, /userId\s*=\s*:userId/);
  assert.deepEqual(options.replacements, { hostId: 42, fromDateUnix, tillDateUnix });
  assert.equal(rows.length, 1);
  assert.equal(rows[0].reportDate, dayStartUnix('2026-09-01'));
});

test('service returns a filled day-wise activity trend series', async (t) => {
  stubHostSettings(t);
  const captured = stubRepositoryRows(t, [
    {
      reportDate: dayStartUnix('2026-09-01'),
      attendance: '2',
      visits: '5',
      orders: '3',
      payments: '1',
    },
    { reportDate: dayStartUnix('2026-09-05'), attendance: 4, visits: 9, orders: 6, payments: 7 },
  ]);

  const result = await reportService.getActivityTrendReport({
    hostId: '42',
    filter: { activityTrend: { fromDate: '2026-08-31', tillDate: '2026-09-06' } },
  });

  assert.equal(captured.length, 1);
  assert.deepEqual(captured[0], {
    hostId: 42,
    fromDateUnix: dayStartUnix('2026-08-31'),
    tillDateUnix: dayEndUnix('2026-09-06'),
  });

  assert.deepEqual(result, {
    activityTrend: [
      { day: '31 Aug', attendance: 0, visits: 0, orders: 0, payments: 0 },
      { day: '1 Sep', attendance: 2, visits: 5, orders: 3, payments: 1 },
      { day: '2 Sep', attendance: 0, visits: 0, orders: 0, payments: 0 },
      { day: '3 Sep', attendance: 0, visits: 0, orders: 0, payments: 0 },
      { day: '4 Sep', attendance: 0, visits: 0, orders: 0, payments: 0 },
      { day: '5 Sep', attendance: 4, visits: 9, orders: 6, payments: 7 },
      { day: '6 Sep', attendance: 0, visits: 0, orders: 0, payments: 0 },
    ],
  });
});

test('service defaults to the last 7 days in the host timezone when no filter is provided', async (t) => {
  stubHostSettings(t);
  const captured = stubRepositoryRows(t, []);

  const result = await reportService.getActivityTrendReport({ hostId: 42 });

  assert.equal(captured.length, 1);
  const expectedTill = moment.tz(HOST_TIMEZONE).endOf('day').unix();
  const expectedFrom = moment.tz(HOST_TIMEZONE).subtract(6, 'days').startOf('day').unix();
  assert.equal(captured[0].hostId, 42);
  assert.ok(Math.abs(captured[0].tillDateUnix - expectedTill) <= 5);
  assert.ok(Math.abs(captured[0].fromDateUnix - expectedFrom) <= 5);
  assert.equal(result.activityTrend.length, 7);
  result.activityTrend.forEach((point) => {
    assert.match(point.day, /^\d{1,2} [A-Z][a-z]{2}$/);
    assert.equal(point.attendance, 0);
    assert.equal(point.visits, 0);
    assert.equal(point.orders, 0);
    assert.equal(point.payments, 0);
  });
});

test('service rejects invalid activity trend dates', async (t) => {
  stubHostSettings(t);
  stubRepositoryRows(t, []);

  await assert.rejects(
    () =>
      reportService.getActivityTrendReport({
        hostId: 42,
        filter: { activityTrend: { fromDate: '31-08-2026', tillDate: '2026-09-06' } },
      }),
    /must be valid YYYY-MM-DD dates/
  );
});

test('service rejects fromDate greater than tillDate', async (t) => {
  stubHostSettings(t);
  stubRepositoryRows(t, []);

  await assert.rejects(
    () =>
      reportService.getActivityTrendReport({
        hostId: 42,
        filter: { activityTrend: { fromDate: '2026-09-06', tillDate: '2026-08-31' } },
      }),
    /fromDate must be less than or equal to/
  );
});

test('service requires hostId', async (t) => {
  stubHostSettings(t);
  stubRepositoryRows(t, []);

  await assert.rejects(
    () => reportService.getActivityTrendReport({ filter: { activityTrend: {} } }),
    (error) => error && error.code === 'REPORT_HOST_SCOPE_REQUIRED'
  );
});
