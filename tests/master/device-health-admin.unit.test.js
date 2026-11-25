require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { UserDevice, UserDeviceHealth, HostSettings } = require('../../src/models');
const { logger } = require('../../src/config/database');
const controller = require('../../src/modules/master/controllers/user.controller').default;
const { requireSupportReadOnlyPolicy } = require('../../src/shared/middleware/support-access.middleware');

function setup(t, devices = [], snapshots = [], settingsByHost = {}) {
  const findSettings = t.mock.method(HostSettings, 'findAll', async (options) =>
    settingsByHost[options.where.hostId] || []);
  const findDevice = t.mock.method(UserDevice, 'findOne', async (options) => {
    assert.deepEqual(options.order, [['id', 'DESC']]);
    assert.equal(options.logging, false);
    return devices.filter((d) => d.hostId === options.where.hostId && d.userId === options.where.userId
      && d.isActive === options.where.isActive).sort((a, b) => b.id - a.id)[0] || null;
  });
  const findHealth = t.mock.method(UserDeviceHealth, 'findOne', async (options) => {
    assert.equal(options.logging, false);
    const found = snapshots.find((s) => s.hostId === options.where.hostId && s.userId === options.where.userId
      && s.deviceId === options.where.deviceId && s.isDeleted === options.where.isDeleted);
    return found ? { deviceId: found.deviceId, get: () => found } : null;
  });
  return { findDevice, findHealth, findSettings };
}

async function send(body, user = { hostId: 1, id: 8 }) {
  const res = { json(value) { this.body = value; return this; } };
  let error;
  await controller.getDeviceHealth({ body, user }, res, (value) => { error = value; });
  return { body: res.body, error };
}

test('reads an explicitly selected device within host and user scope, including inactive devices', async (t) => {
  const fixture = setup(t, [], [
    { hostId: 2, userId: 3, deviceId: 'old', isDeleted: 0 },
    { hostId: 1, userId: 3, deviceId: 'old', isDeleted: 0 },
  ]);
  const result = await send({ hostId: '1', userId: 3, deviceId: 'old' });
  assert.equal(result.body.data.deviceHealth.deviceId, 'old');
  assert.equal(fixture.findDevice.mock.callCount(), 0);
  assert.deepEqual(fixture.findHealth.mock.calls[0].arguments[0].where,
    { hostId: 1, userId: 3, deviceId: 'old', isDeleted: 0 });
});

test('selects the highest-ID active device and never falls back to another snapshot', async (t) => {
  const fixture = setup(t, [
    { id: 1, hostId: 1, userId: 3, isActive: 1, deviceId: 'older' },
    { id: 2, hostId: 1, userId: 3, isActive: 1, deviceId: 'latest' },
    { id: 3, hostId: 1, userId: 3, isActive: 0, deviceId: 'inactive' },
    { id: 4, hostId: 2, userId: 3, isActive: 1, deviceId: 'other-host' },
    { id: 5, hostId: 1, userId: 4, isActive: 1, deviceId: 'other-user' },
  ], [{ hostId: 1, userId: 3, deviceId: 'older', isDeleted: 0 }]);
  const result = await send({ hostId: 1, userId: 3 });
  assert.equal(result.body.data.deviceHealth, null);
  assert.equal(fixture.findHealth.mock.calls[0].arguments[0].where.deviceId, 'latest');
});

test('returns null for no active device and soft-deleted snapshots', async (t) => {
  const fixture = setup(t, [], [{ hostId: 1, userId: 3, deviceId: 'old', isDeleted: 1 }]);
  assert.equal((await send({ hostId: 1, userId: 3 })).body.data.deviceHealth, null);
  assert.equal(fixture.findHealth.mock.callCount(), 0);
  assert.equal((await send({ hostId: 1, userId: 3, deviceId: 'old' })).body.data.deviceHealth, null);
  assert.equal(fixture.findSettings.mock.callCount(), 0);
});

test('returns the active device snapshot', async (t) => {
  setup(t, [{ id: 1, hostId: 1, userId: 3, isActive: 1, deviceId: 'active' }],
    [{ hostId: 1, userId: 3, deviceId: 'active', isDeleted: 0 }]);
  assert.equal((await send({ hostId: 1, userId: 3 })).body.data.deviceHealth.deviceId, 'active');
});

test('formats snapshot timestamps with the authenticated host settings without changing other fields', async (t) => {
  const row = (hostId) => ({
    hostId, userId: 3, deviceId: 'active', isDeleted: 0, sequence: 42,
    collectedAt: '1704067200', receivedAt: 1704067200, createdAt: 1704067200,
    updatedAt: hostId === 1 ? null : '1704067200',
    lastLocationFetchAt: 1704067200, lastSuccessfulLocationAt: hostId === 1 ? null : 1704067200,
  });
  const settings = (timezone) => [
    { settingName: 'timezone', settingValue: timezone },
    { settingName: 'dateTimeFormat', settingValue: 'YYYY-MM-DD HH:mm:ss' },
  ];
  const fixture = setup(t, [], [row(1), row(2)], {
    1: settings('Asia/Kolkata'),
    2: settings('America/New_York'),
  });
  const first = (await send({ hostId: 1, userId: 3, deviceId: 'active' })).body.data.deviceHealth;
  assert.equal(first.collectedAt, '2024-01-01 05:30:00');
  assert.equal(first.receivedAt, '2024-01-01 05:30:00');
  assert.equal(first.createdAt, '2024-01-01 05:30:00');
  assert.equal(first.lastLocationFetchAt, '2024-01-01 05:30:00');
  assert.equal(first.updatedAt, null);
  assert.equal(first.lastSuccessfulLocationAt, null);
  assert.equal(first.sequence, 42);
  const second = (await send({ hostId: 2, userId: 3, deviceId: 'active' },
    { hostId: 2, id: 8 })).body.data.deviceHealth;
  assert.equal(second.collectedAt, '2023-12-31 19:00:00');
  assert.equal(second.updatedAt, '2023-12-31 19:00:00');
  assert.equal(second.lastSuccessfulLocationAt, '2023-12-31 19:00:00');
  assert.deepEqual(fixture.findSettings.mock.calls.map((call) => call.arguments[0].where.hostId), [1, 2]);
});

test('does not return a collation-equivalent but different device ID', async (t) => {
  t.mock.method(UserDeviceHealth, 'findOne', async () => ({
    deviceId: 'DEVICE', get: () => ({ deviceId: 'DEVICE' }),
  }));
  assert.equal((await send({ hostId: 1, userId: 3, deviceId: 'device' })).body.data.deviceHealth, null);
});

test('rejects invalid input and cross-host requests before querying', async (t) => {
  const fixture = setup(t);
  for (const body of [
    { hostId: 2, userId: 3 },
    { hostId: 1, userId: 0 },
    { hostId: 1, userId: 3, deviceId: '' },
    { hostId: 1, userId: 3, deviceId: { $ne: null } },
    { hostId: 1, userId: Number.MAX_SAFE_INTEGER + 1 },
    { hostId: 1, userId: 3, extra: true },
  ]) {
    const result = await send(body);
    assert.ok(result.error);
    assert.ok([400, 403].includes(result.error.statusCode));
  }
  assert.equal(fixture.findDevice.mock.callCount(), 0);
  assert.equal(fixture.findHealth.mock.callCount(), 0);
  assert.equal((await send({ hostId: 1, userId: 3 }, null)).error.statusCode, 401);
});

test('sanitizes persistence errors', async (t) => {
  t.mock.method(UserDevice, 'findOne', async () => { throw new Error('private SQL and device ID'); });
  const log = t.mock.method(logger, 'error', () => undefined);
  const result = await send({ hostId: 1, userId: 3 });
  assert.equal(result.error.code, 'DEVICE_HEALTH_UNAVAILABLE');
  assert.equal(result.error.statusCode, 500);
  assert.doesNotMatch(result.error.message, /private SQL/);
  assert.doesNotMatch(JSON.stringify(log.mock.calls[0].arguments), /private SQL/);
});

test('read-only support may use the endpoint', () => {
  let continued = false;
  requireSupportReadOnlyPolicy({
    path: '/users/getDeviceHealth',
    authContext: { isSupportSession: true, accessMode: 'SUPPORT_READ_ONLY' },
  }, {}, () => { continued = true; });
  assert.equal(continued, true);
});
