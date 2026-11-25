require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { createApiLoggingMiddleware, createApiLoggingErrorMiddleware } =
  require('../../src/modules/api-logs/middleware/api-logging.middleware');

test('admin device-health requests, responses, IDs and error details are omitted from API logs', async (t) => {
  const previous = process.env.API_LOG_SKIP_HOST_IDS;
  delete process.env.API_LOG_SKIP_HOST_IDS;
  t.after(() => {
    if (previous === undefined) delete process.env.API_LOG_SKIP_HOST_IDS;
    else process.env.API_LOG_SKIP_HOST_IDS = previous;
  });
  const created = [];
  const finalized = [];
  const service = {
    async createProcessingLog(input) { created.push(input); return 1; },
    async queueFinalizeLog(input) { finalized.push(input); },
  };
  const req = {
    originalUrl: '/api/v1/admin/users/getDeviceHealth/?q=1',
    path: '/api/v1/admin/users/getDeviceHealth/', method: 'POST',
    headers: { 'x-device-id': 'private-id' },
    body: { hostId: 1, userId: 2, deviceId: 'private-id' },
  };
  const res = new EventEmitter();
  res.locals = {};
  res.statusCode = 200;
  res.json = () => res;
  res.send = () => res;
  res.getHeader = () => undefined;
  await createApiLoggingMiddleware(service)(req, res, () => undefined);
  createApiLoggingErrorMiddleware()(new Error('private error'), req, res, () => undefined);
  res.json({ data: { deviceId: 'private-id', trackingIssue: 'private detail' } });
  res.emit('finish');
  await new Promise((resolve) => setImmediate(resolve));
  assert.equal(created[0].requestBody, '[device health body omitted]');
  assert.equal(created[0].deviceId, undefined);
  assert.equal(finalized[0].responseBody, '[device health response omitted]');
  assert.equal(finalized[0].errorMessage, undefined);
});
