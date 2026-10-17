require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { EventEmitter } = require('node:events');
const { logger } = require('../../src/config/database');
const {
  createApiLoggingMiddleware,
  createApiLoggingErrorMiddleware,
} = require('../../src/modules/api-logs/middleware/api-logging.middleware');

async function makeHarness(context, configuration = '[7,12]', request = {}) {
  const previous = process.env.API_LOG_SKIP_HOST_IDS;
  if (configuration === null) delete process.env.API_LOG_SKIP_HOST_IDS;
  else process.env.API_LOG_SKIP_HOST_IDS = configuration;
  context.after(() => {
    if (previous === undefined) delete process.env.API_LOG_SKIP_HOST_IDS;
    else process.env.API_LOG_SKIP_HOST_IDS = previous;
  });
  const warnings = context.mock.method(logger, 'warn', () => undefined);
  context.mock.method(logger, 'error', () => undefined);
  const created = [];
  const finalized = [];
  const service = {
    async createProcessingLog(input) {
      created.push(input);
      return 101;
    },
    async queueFinalizeLog(input) {
      finalized.push(input);
    },
  };
  const req = {
    originalUrl: '/api/v1/app/task/getTasks', path: '/api/v1/app/task/getTasks', method: 'POST',
    headers: {}, body: { password: 'hidden', attachmentId: 123 }, ...request,
  };
  const res = new EventEmitter();
  res.locals = {};
  res.statusCode = 200;
  res.json = (body) => { res.body = body; return res; };
  res.send = (body) => { res.body = body; return res; };
  res.getHeader = () => undefined;
  let nextCalls = 0;
  const middleware = createApiLoggingMiddleware(service);
  await middleware(req, res, () => { nextCalls += 1; });
  assert.equal(nextCalls, 1);
  const finish = async () => {
    res.emit('finish');
    await new Promise((resolve) => setImmediate(resolve));
  };
  return { req, res, service, created, finalized, warnings, finish };
}

test('excluded host resolved after authentication creates no row or finalize job', async (context) => {
  const { req, res, created, finalized, finish } = await makeHarness(context);
  assert.equal(created.length, 0);
  req.user = { id: 22, hostId: 7 };
  res.json({ success: true });
  await finish();
  assert.equal(created.length, 0);
  assert.equal(finalized.length, 0);
  assert.equal(req.apiLogId, undefined);
});

test('authenticated excluded host takes precedence over non-excluded header and body', async (context) => {
  const { req, created, finalized, finish } = await makeHarness(context, '[7,12]', {
    headers: { 'x-host-id': '99' }, body: { hostId: 99 },
  });
  req.user = { id: 22, hostId: 12 };
  await finish();
  assert.equal(created.length, 0);
  assert.equal(finalized.length, 0);
});

test('spoofed excluded header/body cannot suppress logging for a non-excluded authenticated host', async (context) => {
  const { req, res, created, finalized, finish } = await makeHarness(context, '[7,12]', {
    headers: { 'x-host-id': '7' }, body: { hostId: 7, password: 'hidden' },
  });
  req.user = { id: 22, hostId: 99 };
  res.json({ success: true, token: 'hidden' });
  await finish();
  assert.equal(created.length, 1);
  assert.equal(created[0].hostId, 99);
  assert.equal(created[0].userId, 22);
  assert.equal(created[0].requestBody.password, '[masked]');
  assert.equal(finalized.length, 1);
  assert.equal(finalized[0].hostId, 99);
  assert.equal(finalized[0].responseBody.token, '[masked]');
  assert.equal(finalized[0].status, 'SUCCESS');
});

test('header and body host fallbacks are excluded when authentication supplies no host', async (context) => {
  const header = await makeHarness(context, '[7,12]', { headers: { 'x-host-id': '7' } });
  await header.finish();
  assert.equal(header.created.length, 0);
  assert.equal(header.finalized.length, 0);
  const body = await makeHarness(context, '[7,12]', { body: { hostId: '12' } });
  await body.finish();
  assert.equal(body.created.length, 0);
  assert.equal(body.finalized.length, 0);
});

test('header resolution retains precedence over request body', async (context) => {
  const { created, finalized, finish } = await makeHarness(context, '[7]', {
    headers: { 'x-host-id': '99' }, body: { hostId: 7 },
  });
  await finish();
  assert.equal(created[0].hostId, 99);
  assert.equal(finalized.length, 1);
});

test('unknown hosts continue to be logged', async (context) => {
  const { created, finalized, finish } = await makeHarness(context);
  await finish();
  assert.equal(created.length, 1);
  assert.equal(created[0].hostId, undefined);
  assert.equal(finalized.length, 1);
});

test('excluded hosts do not persist failed responses or error details', async (context) => {
  const { req, res, created, finalized, finish } = await makeHarness(context);
  req.user = { hostId: 7 };
  res.statusCode = 500;
  createApiLoggingErrorMiddleware()(new Error('controller failed'), req, res, () => undefined);
  res.json({ success: false, message: 'controller failed' });
  await finish();
  assert.equal(created.length, 0);
  assert.equal(finalized.length, 0);
});

test('non-excluded deferred error logs retain the original error and failure status', async (context) => {
  const { req, res, created, finalized, finish } = await makeHarness(context);
  req.user = { id: 22, hostId: 99 };
  res.statusCode = 500;
  let forwarded;
  const error = new Error('controller failed');
  createApiLoggingErrorMiddleware()(error, req, res, (value) => { forwarded = value; });
  res.json({ success: false });
  await finish();
  assert.equal(forwarded, error);
  assert.equal(created.length, 1);
  assert.equal(finalized[0].status, 'FAILED');
  assert.equal(finalized[0].responseStatusCode, 500);
  assert.equal(finalized[0].errorMessage, 'controller failed');
});

test('empty or unset exclusions preserve pre-controller PROCESSING creation', async (context) => {
  for (const configuration of [null, '', '[]']) {
    const harness = await makeHarness(context, configuration);
    assert.equal(harness.created.length, 1);
    assert.equal(harness.req.apiLogId, 101);
    harness.req.user = { id: 22, hostId: 99 };
    await harness.finish();
    assert.equal(harness.finalized[0].hostId, 99);
  }
});

test('invalid configuration warns and keeps logging enabled', async (context) => {
  for (const configuration of ['7,12', '{}', 'null', '["7"]', '[0]', '[-1]', '[1.5]', '[9007199254740992]']) {
    const { created, warnings, finish } = await makeHarness(context, configuration, { user: { hostId: 7 } });
    assert.equal(created.length, 1);
    assert.ok(warnings.mock.callCount() >= 1);
    await finish();
  }
});

test('trimmed JSON arrays and duplicate IDs are supported', async (context) => {
  const { created, finalized, finish } = await makeHarness(context, ' [7, 7, 12] ', { user: { hostId: '7' } });
  await finish();
  assert.equal(created.length, 0);
  assert.equal(finalized.length, 0);
});

test('existing path skips and disabled requests create no logs', async (context) => {
  for (const request of [{ originalUrl: '/api/health' }, { apiLoggingDisabled: true }]) {
    const { created, finalized, finish } = await makeHarness(context, '[7]', request);
    await finish();
    assert.equal(created.length, 0);
    assert.equal(finalized.length, 0);
  }
});

test('route-level disabling after global middleware prevents deferred persistence', async (context) => {
  const { req, created, finalized, finish } = await makeHarness(context);
  req.apiLoggingDisabled = true;
  await finish();
  assert.equal(created.length, 0);
  assert.equal(finalized.length, 0);
});

test('logging failures do not change the API response or enqueue orphan updates', async (context) => {
  const { res, service, finalized, finish } = await makeHarness(context);
  service.createProcessingLog = async () => { throw new Error('database unavailable'); };
  res.json({ success: true });
  await finish();
  assert.deepEqual(res.body, { success: true });
  assert.equal(finalized.length, 0);
});