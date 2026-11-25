const test = require('node:test');
const assert = require('node:assert/strict');

test('MySQL serializes concurrent snapshots and preserves the newest collection time', {
  skip: !process.env.DEVICE_HEALTH_TEST_DB_NAME
    ? 'Requires DEVICE_HEALTH_TEST_DB_* settings for an empty disposable test database'
    : false,
}, async () => {
  function required(key) {
    const value = process.env[`DEVICE_HEALTH_TEST_DB_${key}`];
    assert.ok(value, `DEVICE_HEALTH_TEST_DB_${key} is required`);
    return value;
  }
  const name = required('NAME');
  assert.match(name, /(?:^|_)test(?:_|$)/i);
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME_TEST = name;
  process.env.DB_USER = required('USER');
  process.env.DB_PASSWORD = required('PASSWORD');
  process.env.DB_HOST = required('HOST');
  process.env.DB_PORT = required('PORT');
  require('ts-node/register/transpile-only');
  const Sequelize = require('sequelize');
  const { sequelize, UserDeviceHealth } = require('../../src/models');
  const service = require('../../src/modules/sync/services/device-health.service').default;
  const migration = require('../../src/migrations/20261125100000-create-wd-user-device-health');
  const qi = sequelize.getQueryInterface();
  let owned = false;
  try {
    assert.equal((await qi.showAllTables()).length, 0, 'Use an empty dedicated database');
    owned = true;
    await qi.createTable('wd_user_devices', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: { type: Sequelize.BIGINT, allowNull: false },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      deviceId: { type: Sequelize.STRING(255), allowNull: false },
    });
    await qi.addIndex('wd_user_devices', ['hostId', 'userId', 'deviceId'], { unique: true });
    await migration.up(qi, Sequelize);
    await sequelize.query("INSERT INTO wd_user_devices (hostId, userId, deviceId) VALUES (1, 2, 'device-1')");
    const now = Math.floor(Date.now() / 1000);
    const payload = {
      hostId: 1, userId: 2, deviceId: 'device-1', schemaVersion: 1, sequence: 1,
      collectedAt: now - 20, syncReason: 'INITIAL',
      deviceInfo: { deviceModel: '', manufacturer: 'Maker', androidVersion: '15', sdkInt: 35, appVersion: '1.0', versionCode: 1 },
      permissions: { locationPermission: 'FINE', backgroundLocationPermission: 'GRANTED', cameraPermission: 'DENIED', microphonePermission: 'GRANTED', notificationPermission: 'GRANTED' },
      deviceSettings: { locationEnabled: true, gpsProviderEnabled: null, batteryOptimizationIgnored: false, batterySaverEnabled: false, backgroundRestricted: null, appNotificationsEnabled: true, trackingNotificationChannelEnabled: null },
      trackingDiagnostics: { trackingExpected: true, trackingServiceRunning: true, trackingStatus: 'ACTIVE', trackingIssue: null, lastLocationFetchResult: 'NOT_ATTEMPTED', lastLocationFailureReason: null, lastLocationFetchAt: null, lastSuccessfulLocationAt: null, lastLocationAccuracyMeters: null },
      network: { connected: true, internetValidated: null, networkType: 'WIFI' },
    };
    const newer = { ...payload, sequence: 2, collectedAt: now - 19 };
    const outcomes = await Promise.all([
      service.sync({ hostId: 1, id: 2 }, payload),
      service.sync({ hostId: 1, id: 2 }, newer),
      service.sync({ hostId: 1, id: 2 }, newer),
    ]);
    assert.equal(outcomes.filter((outcome) => outcome === 'created').length, 1);
    assert.equal(await UserDeviceHealth.count(), 1);
    const row = await UserDeviceHealth.findOne();
    assert.equal(Number(row.collectedAt), newer.collectedAt);
    assert.equal(row.gpsProviderEnabled, null);
    assert.equal(await service.sync({ hostId: 1, id: 2 }, newer), 'duplicate');
    assert.equal(await service.sync({ hostId: 1, id: 2 }, payload), 'stale');
  } finally {
    try {
      if (owned) {
        const tables = await qi.showAllTables();
        for (const table of ['wd_user_device_health', 'wd_user_devices']) {
          if (tables.includes(table)) await qi.dropTable(table);
        }
      }
    } finally {
      await sequelize.close();
    }
  }
});
