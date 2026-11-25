require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const http = require('node:http');
const express = require('express');
const { requireDeviceHealthJson, handleDeviceHealthBodyError } = require('../../src/modules/sync/middleware/device-health-body.middleware');

test('device health body limit applies before global parsing, including chunked requests', async (t) => {
  const app = express();
  app.use(requireDeviceHealthJson);
  app.use(handleDeviceHealthBodyError);
  app.use(express.json());
  app.post('/api/v1/app/sync/deviceHealth', (req, res) => res.json({ success: true }));
  app.post('/other', (req, res) => res.json({ success: true }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const request = (path, body, contentType = 'application/json') => new Promise((resolve, reject) => {
    const req = http.request({
      host: '127.0.0.1', port: server.address().port, path, method: 'POST',
      headers: { 'content-type': contentType, 'transfer-encoding': 'chunked' },
    }, (res) => {
      let output = '';
      res.on('data', (chunk) => { output += chunk; });
      res.on('end', () => resolve({ status: res.statusCode, body: JSON.parse(output) }));
    });
    req.on('error', reject);
    req.write(body);
    req.end();
  });
  const large = JSON.stringify({ value: 'x'.repeat(17000) });
  assert.equal((await request('/api/v1/app/sync/deviceHealth', large)).status, 413);
  assert.equal((await request('/API/v1/app/sync/devicehealth/?x=1', large)).status, 413);
  assert.equal((await request('/other', large)).status, 200);
  const malformed = await request('/api/v1/app/sync/deviceHealth', '{"secret":');
  assert.equal(malformed.status, 400);
  assert.doesNotMatch(JSON.stringify(malformed.body), /secret/);
  assert.equal((await request('/api/v1/app/sync/deviceHealth', '{}', 'text/plain')).status, 415);
});

test('app route requires a verified access token before accepting a device health request', async (t) => {
  const jwt = require('jsonwebtoken');
  const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
  const service = require('../../src/modules/sync/services/device-health.service').default;
  const appRoutes = require('../../src/routes/v1/app').default;
  const previous = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'device-health-test-secret';
  t.after(() => {
    if (previous === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = previous;
  });
  t.mock.method(userRepository, 'findById', async () => ({
    id: '2', hostId: '1', accountStatus: 'ACTIVE', roleId: 1,
  }));
  const sync = t.mock.method(service, 'sync', async () => 'created');
  const app = express();
  app.use(requireDeviceHealthJson);
  app.use(handleDeviceHealthBodyError);
  app.use(express.json());
  app.use('/api/v1/app', appRoutes);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ success: false }));
  const server = app.listen(0, '127.0.0.1');
  await new Promise((resolve) => server.once('listening', resolve));
  t.after(() => new Promise((resolve) => server.close(resolve)));
  const body = {
    hostId: 1, userId: 2, deviceId: 'registered', schemaVersion: 1, sequence: 1,
    collectedAt: Math.floor(Date.now() / 1000), syncReason: 'INITIAL',
    deviceInfo: { deviceModel: '', manufacturer: '', androidVersion: '15', sdkInt: 35, appVersion: '1', versionCode: 1 },
    permissions: { locationPermission: 'FINE', backgroundLocationPermission: 'GRANTED', cameraPermission: 'DENIED', microphonePermission: 'DENIED', notificationPermission: 'GRANTED' },
    deviceSettings: { locationEnabled: true, gpsProviderEnabled: null, batteryOptimizationIgnored: false, batterySaverEnabled: false, backgroundRestricted: null, appNotificationsEnabled: true, trackingNotificationChannelEnabled: null },
    trackingDiagnostics: { trackingExpected: true, trackingServiceRunning: true, trackingStatus: 'ACTIVE', trackingIssue: null, lastLocationFetchResult: 'NOT_ATTEMPTED', lastLocationFailureReason: null, lastLocationFetchAt: null, lastSuccessfulLocationAt: null, lastLocationAccuracyMeters: null },
    network: { connected: true, internetValidated: null, networkType: 'WIFI' },
  };
  const endpoint = `http://127.0.0.1:${server.address().port}/api/v1/app/sync/deviceHealth`;
  const post = (authorization) => fetch(endpoint, {
    method: 'POST', headers: { 'content-type': 'application/json', ...(authorization ? { authorization } : {}) },
    body: JSON.stringify(body),
  });
  assert.equal((await post()).status, 401);
  assert.equal(sync.mock.callCount(), 0);
  const token = jwt.sign({ userId: 2, tokenType: 'access' }, process.env.JWT_SECRET);
  const response = await post(`Bearer ${token}`);
  assert.equal(response.status, 200);
  assert.equal((await response.json()).data.status, 'created');
  assert.deepEqual(sync.mock.calls[0].arguments[0], { hostId: 1, id: 2 });
});
