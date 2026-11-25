require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, UserDevice, UserDeviceHealth } = require('../../src/models');
const controller = require('../../src/modules/sync/controllers/sync.controller').default;
const { deviceHealthSchema } = require('../../src/modules/sync/types/device-health.schema');

const now = Math.floor(Date.now() / 1000);
const user = { id: 2, hostId: 1 };
function payload() {
  return {
    hostId: 1, userId: 2, deviceId: 'device-1', schemaVersion: 1, sequence: 1,
    collectedAt: now - 20, syncReason: 'INITIAL',
    deviceInfo: { deviceModel: '', manufacturer: 'Maker', androidVersion: '15', sdkInt: 35, appVersion: '1.0', versionCode: 1 },
    permissions: { locationPermission: 'FINE', backgroundLocationPermission: 'GRANTED', cameraPermission: 'DENIED', microphonePermission: 'GRANTED', notificationPermission: 'NOT_APPLICABLE' },
    deviceSettings: { locationEnabled: true, gpsProviderEnabled: null, batteryOptimizationIgnored: false, batterySaverEnabled: false, backgroundRestricted: null, appNotificationsEnabled: true, trackingNotificationChannelEnabled: null },
    trackingDiagnostics: { trackingExpected: true, trackingServiceRunning: true, trackingStatus: 'ACTIVE', trackingIssue: null, lastLocationFetchResult: 'SUCCESS', lastLocationFailureReason: null, lastLocationFetchAt: now - 30, lastSuccessfulLocationAt: now - 30, lastLocationAccuracyMeters: 10.5 },
    network: { connected: true, internetValidated: null, networkType: 'WIFI' },
  };
}

function setup(t, registered = [{ hostId: 1, userId: 2, deviceId: 'device-1' }]) {
  let current = null;
  let tail = Promise.resolve();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(sequelize, 'transaction', async (options, work) => {
    assert.equal(options.logging, false);
    const previous = tail;
    let release;
    tail = new Promise((resolve) => { release = resolve; });
    await previous;
    try { return await work(transaction); } finally { release(); }
  });
  const findDevice = t.mock.method(UserDevice, 'findOne', async (options) => {
    assert.equal(options.lock, 'UPDATE');
    assert.equal(options.logging, false);
    return registered.find((device) =>
      device.hostId === options.where.hostId && device.userId === options.where.userId &&
      device.deviceId === options.where.deviceId) || null;
  });
  const findSnapshot = t.mock.method(UserDeviceHealth, 'findOne', async (options) => {
    assert.equal(options.lock, 'UPDATE');
    return current;
  });
  const create = t.mock.method(UserDeviceHealth, 'create', async (values) => {
    current = UserDeviceHealth.build({ id: 10, isDeleted: 0, ...values });
    current.update = async (changed) => { current.set(changed); return current; };
    return current;
  });
  return { findDevice, findSnapshot, create, get current() { return current; } };
}

async function send(body, authenticatedUser = user) {
  const res = {
    statusCode: 200,
    status(code) { this.statusCode = code; return this; },
    json(value) { this.body = value; return this; },
  };
  let error;
  await controller.syncDeviceHealth({ body, user: authenticatedUser }, res, (value) => { error = value; });
  return { res, error };
}

test('validates Android schema, nullable observations, numeric bounds, enums and unknown fields', () => {
  const valid = payload();
  assert.equal(deviceHealthSchema.safeParse(valid).success, true);
  const invalid = [
    { ...valid, sequence: Number.MAX_SAFE_INTEGER + 1 },
    { ...valid, collectedAt: now * 1000 },
    { ...valid, deviceId: ' ' },
    { ...valid, receivedAt: now },
    { ...valid, permissions: { ...valid.permissions, locationPermission: 'GRANTED' } },
    { ...valid, deviceSettings: { ...valid.deviceSettings, locationEnabled: 'true' } },
    { ...valid, trackingDiagnostics: { ...valid.trackingDiagnostics, lastLocationAccuracyMeters: -1 } },
    { ...valid, trackingDiagnostics: { ...valid.trackingDiagnostics, lastLocationAccuracyMeters: Infinity } },
    { ...valid, network: { ...valid.network, extra: true } },
    { ...valid, schemaVersion: 2 },
  ];
  for (const value of invalid) assert.equal(deviceHealthSchema.safeParse(value).success, false);
});

test('rejects invalid payload, unsupported versions and mismatched authenticated identities before querying', async (t) => {
  const fixture = setup(t);
  assert.equal((await send({ ...payload(), schemaVersion: 2 })).error.code, 'DEVICE_HEALTH_UNSUPPORTED_VERSION');
  assert.equal((await send({ ...payload(), sequence: 0 })).error.code, 'DEVICE_HEALTH_INVALID_PAYLOAD');
  for (const body of [{ ...payload(), hostId: 3 }, { ...payload(), userId: 3 }]) {
    const result = await send(body);
    assert.equal(result.error.statusCode, 403);
    assert.equal(result.error.code, 'DEVICE_HEALTH_IDENTITY_MISMATCH');
  }
  assert.equal(fixture.findDevice.mock.callCount(), 0);
});

test('rejects devices registered to another user or host without creating a snapshot', async (t) => {
  const fixture = setup(t, [
    { hostId: 1, userId: 3, deviceId: 'device-1' },
    { hostId: 4, userId: 2, deviceId: 'device-1' },
  ]);
  const result = await send(payload());
  assert.equal(result.error.statusCode, 403);
  assert.equal(result.error.code, 'DEVICE_HEALTH_DEVICE_NOT_REGISTERED');
  assert.equal(fixture.create.mock.callCount(), 0);
  assert.equal(fixture.findSnapshot.mock.callCount(), 0);
});

test('accepts safe BIGINT identity strings returned by MySQL and rejects unsafe identities', async (t) => {
  const fixture = setup(t);
  assert.equal((await send(payload(), { id: '2', hostId: '1' })).res.body.data.status, 'created');
  const result = await send(payload(), { id: '9007199254740993', hostId: '1' });
  assert.equal(result.error.statusCode, 401);
  assert.equal(fixture.findDevice.mock.callCount(), 1);
});

test('accepts an inactive registered device without changing registration', async (t) => {
  const fixture = setup(t, [{ hostId: 1, userId: 2, deviceId: 'device-1', isActive: 0 }]);
  assert.equal((await send(payload())).res.body.data.status, 'created');
  assert.deepEqual(fixture.findDevice.mock.calls[0].arguments[0].where, {
    hostId: 1, userId: 2, deviceId: 'device-1',
  });
});

test('creates and updates snapshots, detects duplicate and rejects stale or ambiguous requests', async (t) => {
  const fixture = setup(t);
  const first = payload();
  const before = Math.floor(Date.now() / 1000);
  assert.equal((await send(first)).res.body.data.status, 'created');
  const received = fixture.current.receivedAt;
  const update = t.mock.method(fixture.current, 'update');
  assert.ok(received >= before && received <= Math.floor(Date.now() / 1000));
  assert.equal(fixture.current.gpsProviderEnabled, null);
  assert.equal((await send(first)).res.body.data.status, 'duplicate');
  assert.equal(update.mock.callCount(), 0);
  assert.equal(fixture.current.receivedAt, received);
  assert.equal(fixture.create.mock.callCount(), 1);
  const newer = { ...first, sequence: 1, collectedAt: first.collectedAt + 2, syncReason: 'APP_RESUME' };
  assert.equal((await send(newer)).res.body.data.status, 'updated');
  const stale = await send(first);
  assert.equal(stale.res.statusCode, 409);
  assert.equal(stale.res.body.code, 'DEVICE_HEALTH_STALE');
  const ambiguous = await send({ ...newer, sequence: 2 });
  assert.equal(ambiguous.res.statusCode, 409);
  assert.equal(ambiguous.res.body.code, 'DEVICE_HEALTH_AMBIGUOUS');
  assert.equal(fixture.current.sequence, newer.sequence);
  assert.equal(update.mock.callCount(), 1);
});

test('recognizes duplicates with MySQL BIGINT strings and numeric booleans', async (t) => {
  const fixture = setup(t);
  const first = payload();
  await send(first);
  fixture.current.setDataValue('sequence', String(first.sequence));
  fixture.current.setDataValue('collectedAt', String(first.collectedAt));
  fixture.current.setDataValue('versionCode', String(first.deviceInfo.versionCode));
  fixture.current.setDataValue('lastLocationFetchAt', String(first.trackingDiagnostics.lastLocationFetchAt));
  fixture.current.setDataValue('lastSuccessfulLocationAt', String(first.trackingDiagnostics.lastSuccessfulLocationAt));
  fixture.current.setDataValue('locationEnabled', 1);
  fixture.current.setDataValue('batterySaverEnabled', 0);
  assert.equal((await send(first)).res.body.data.status, 'duplicate');
  assert.equal(fixture.create.mock.callCount(), 1);
});

test('serializes competing first requests using the registered device lock', async (t) => {
  const fixture = setup(t);
  const first = payload();
  const second = { ...first, sequence: 2, collectedAt: first.collectedAt + 1 };
  const results = await Promise.all([send(first), send(second), send(second)]);
  assert.deepEqual(results.map((result) => result.res.body.data.status), ['created', 'updated', 'duplicate']);
  assert.equal(fixture.create.mock.callCount(), 1);
  assert.equal(fixture.current.sequence, 2);
});

test('database failures are sanitized and reported as retryable errors', async (t) => {
  setup(t);
  t.mock.method(UserDevice, 'findOne', async () => { throw new Error('device-health-sensitive-content'); });
  const result = await send(payload());
  assert.equal(result.error.statusCode, 500);
  assert.equal(result.error.code, 'DEVICE_HEALTH_UNAVAILABLE');
  assert.doesNotMatch(result.error.message, /sensitive-content/);
});
