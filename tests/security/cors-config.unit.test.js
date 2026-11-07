require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const cors = require('cors');
const cookieParser = require('cookie-parser');
const http = require('node:http');
const { createCorsPolicy } = require('../../src/shared/utils/cors-config.util');
const { requireAdminCsrfToken } = require('../../src/shared/middleware/csrf.middleware');

function startCorsServer(policy) {
  const app = express();
  app.use(cors({ origin: policy.origin, credentials: policy.credentials }));
  app.post('/api/test', (_req, res) => res.json({ ok: true }));
  app.use((error, _req, res, _next) => res.status(403).json({ error: error.message }));
  const server = http.createServer(app);
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

function request(server, method, headers = {}, path = '/api/test') {
  return new Promise((resolve, reject) => {
    const response = http.request({
      host: '127.0.0.1',
      port: server.address().port,
      path,
      method,
      headers,
    }, (result) => {
      const body = [];
      result.on('data', (chunk) => body.push(chunk));
      result.on('end', () => resolve({
        status: result.statusCode,
        headers: result.headers,
        body: Buffer.concat(body).toString('utf8'),
      }));
    });
    response.on('error', reject);
    response.end();
  });
}

test('production requires a nonempty explicit CORS allowlist', () => {
  assert.throws(() => createCorsPolicy('production', undefined), /at least one explicit origin/);
  assert.throws(() => createCorsPolicy('production', ' , '), /at least one explicit origin/);
  assert.throws(() => createCorsPolicy('production', '*'), /wildcard/);
  assert.throws(() => createCorsPolicy('production', 'https://admin.example.com/path'), /without paths/);
  assert.throws(() => createCorsPolicy('production', 'https://*.workdesk24.com'), /wildcard/);
});

test('subdomain configuration accepts only DNS base domains and deduplicates them', () => {
  const policy = createCorsPolicy('production', undefined, ' WorkDesk24.com,workdesk24.com ');
  assert.deepEqual(policy.allowedSubdomainDomains, ['workdesk24.com']);
  for (const domain of ['*', '*.workdesk24.com', 'https://workdesk24.com', 'workdesk24.com/path',
    'workdesk24.com:443', '127.0.0.1', 'localhost', 'workdesk24.com.', '-bad.workdesk24.com']) {
    assert.throws(() => createCorsPolicy('production', undefined, domain), /CORS_SUBDOMAIN_DOMAINS/);
  }
});

test('dynamic HTTPS subdomains receive exact credentialed CORS headers', async (context) => {
  const server = await startCorsServer(createCorsPolicy('production', undefined, 'workdesk24.com'));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  for (const origin of ['https://test.workdesk24.com', 'https://customer123.workdesk24.com', 'https://portal.test.workdesk24.com']) {
    const result = await request(server, 'OPTIONS', {
      Origin: origin,
      'Access-Control-Request-Method': 'POST',
      'Access-Control-Request-Headers': 'content-type,x-csrf-token',
    });
    assert.equal(result.status, 204);
    assert.equal(result.headers['access-control-allow-origin'], origin);
    assert.equal(result.headers['access-control-allow-credentials'], 'true');
    assert.match(result.headers.vary, /Origin/);
  }
});

test('subdomain policy rejects lookalikes, root, HTTP, ports and malformed origins even in development', async (context) => {
  const server = await startCorsServer(createCorsPolicy('development', undefined, 'workdesk24.com'));
  context.after(() => new Promise((resolve) => server.close(resolve)));
  for (const origin of ['https://workdesk24.com', 'https://evilworkdesk24.com',
    'https://test.workdesk24.com.attacker.com', 'http://test.workdesk24.com',
    'https://test.workdesk24.com:8443', 'https://test.workdesk24.com/path',
    'https://test.workdesk24.com/', 'https://user@test.workdesk24.com',
    'https://test.workdesk24.com.', 'https://-bad.workdesk24.com', 'null', 'not-a-url']) {
    const result = await request(server, 'POST', { Origin: origin });
    assert.equal(result.status, 403, origin);
    assert.equal(result.headers['access-control-allow-origin'], undefined, origin);
  }
  assert.equal((await request(server, 'POST')).status, 200);
});

test('exact origins can separately allow root and localhost with dynamic subdomains', () => {
  const policy = createCorsPolicy('production', 'https://workdesk24.com,http://localhost:3000', 'workdesk24.com');
  for (const origin of ['https://workdesk24.com', 'http://localhost:3000', 'https://test.workdesk24.com']) {
    policy.origin(origin, (error, allowed) => {
      assert.equal(error, null);
      assert.equal(allowed, true);
    });
  }
});

test('development with no configured origins preserves current permissive behavior', () => {
  const policy = createCorsPolicy('development', undefined);
  let allowed;
  policy.origin('http://localhost:3000', (error, value) => {
    assert.equal(error, null);
    allowed = value;
  });
  assert.equal(allowed, true);
});

test('allowed origins receive credentialed CORS headers and preflight succeeds', async (context) => {
  const policy = createCorsPolicy('production', 'https://admin.example.com');
  const server = await startCorsServer(policy);
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const result = await request(server, 'OPTIONS', {
    Origin: 'https://admin.example.com',
    'Access-Control-Request-Method': 'POST',
    'Access-Control-Request-Headers': 'content-type,x-csrf-token',
  });

  assert.equal(result.status, 204);
  assert.equal(result.headers['access-control-allow-origin'], 'https://admin.example.com');
  assert.equal(result.headers['access-control-allow-credentials'], 'true');
});

test('unknown origins are rejected and missing Origin remains allowed', async (context) => {
  const policy = createCorsPolicy('production', 'https://admin.example.com');
  const server = await startCorsServer(policy);
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const blocked = await request(server, 'POST', { Origin: 'https://attacker.example' });
  assert.equal(blocked.status, 403);
  assert.equal(blocked.headers['access-control-allow-origin'], undefined);

  const serverRequest = await request(server, 'POST');
  assert.equal(serverRequest.status, 200);
});

test('credentialed admin POST requires matching CSRF cookie/header after CORS allow', async (context) => {
  const policy = createCorsPolicy('production', undefined, 'workdesk24.com');
  const app = express();
  app.use(cors({ origin: policy.origin, credentials: policy.credentials }));
  app.use(cookieParser());
  app.post('/api/v1/admin/test', requireAdminCsrfToken, (_req, res) => res.json({ ok: true }));
  app.use((error, _req, res, _next) => res.status(403).json({ error: error.message }));
  const server = http.createServer(app);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  context.after(() => new Promise((resolve) => server.close(resolve)));

  const valid = await request(server, 'POST', {
    Origin: 'https://test.workdesk24.com',
    Cookie: 'wd24_admin_csrf=csrf-value',
    'x-csrf-token': 'csrf-value',
  }, '/api/v1/admin/test');
  assert.equal(valid.status, 200);
  assert.equal(valid.headers['access-control-allow-credentials'], 'true');

  const missingCsrf = await request(server, 'POST', {
    Origin: 'https://test.workdesk24.com',
    Cookie: 'wd24_admin_csrf=csrf-value',
  }, '/api/v1/admin/test');
  assert.equal(missingCsrf.status, 401);
  assert.equal(missingCsrf.headers['access-control-allow-origin'], 'https://test.workdesk24.com');
});