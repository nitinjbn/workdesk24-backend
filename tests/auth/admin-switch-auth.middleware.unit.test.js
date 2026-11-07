require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const models = require('../../src/models');
const authMiddlewareModule = require('../../src/shared/middleware/auth.middleware');
const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
const switchSessionRepository = require('../../src/modules/auth/repositories/admin-switch-session.repository').default;
const hostService = require('../../src/modules/master/services/host.service').default;
const refreshRepository = require('../../src/modules/auth/repositories/user-refresh-token.repository').default;

test.after(async () => {
  await models.sequelize.close();
});

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
    setHeader() {},
  };
}

function makeRequest(token) {
  return {
    headers: token ? { authorization: `Bearer ${token}` } : {},
    cookies: {},
  };
}

function signToken(claims) {
  process.env.JWT_SECRET = 'unit-test-secret';
  return jwt.sign(claims, process.env.JWT_SECRET, { expiresIn: '5m' });
}

test('unauthenticated caller cannot enter switchUser', async () => {
  const response = createResponse();
  await authMiddlewareModule.switchUserAuthentication(makeRequest(), response, () => {
    assert.fail('Unauthenticated request must not continue');
  });

  assert.equal(response.statusCode, 401);
});

test('normal admin cannot enter switchUser', async (context) => {
  const oldSecret = process.env.JWT_SECRET;
  const response = createResponse();
  const request = makeRequest(signToken({ userId: 12, tokenType: 'access' }));
  context.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  context.mock.method(userRepository, 'findById', async () => ({
    id: 12,
    hostId: 3,
    email: 'admin@example.com',
    name: 'Admin',
    roleId: 4,
    isAdminUser: 1,
    isSuperAdmin: 0,
    accountStatus: 'ACTIVE',
  }));

  await authMiddlewareModule.switchUserAuthentication(request, response, () => {
    assert.fail('Normal admin must not continue');
  });

  assert.equal(response.statusCode, 403);
});

test('switch access token resolves current host from session state and keeps original principal', async (context) => {
  const oldSecret = process.env.JWT_SECRET;
  context.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const token = signToken({
    userId: 7,
    tokenType: 'access',
    switchSessionId: 'switch-uuid',
    contextVersion: 3,
    authContext: 'ADMIN_SWITCH',
  });
  const request = makeRequest(token);
  request.originalUrl = '/api/v1/admin/tasks/getTasks';
  request.body = { hostId: 999, filter: { hostId: 888 } };
  const response = createResponse();
  context.mock.method(userRepository, 'findById', async () => ({
    id: 7,
    hostId: 5,
    email: 'root@example.com',
    name: 'Root',
    roleId: 1,
    isAdminUser: 0,
    isSuperAdmin: 1,
    accountStatus: 'ACTIVE',
  }));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => ({
    switchSessionId: 'switch-uuid',
    userId: 7,
    originalHostId: 5,
    currentHostId: 42,
    sourceTokenFamily: 'source-family',
    contextVersion: 3,
  }));
  context.mock.method(refreshRepository, 'findActiveByFamily', async (userId, tokenFamily) => {
    assert.equal(userId, 7);
    assert.equal(tokenFamily, 'source-family');
    return { id: 8 };
  });
  context.mock.method(hostService, 'getSwitchHostContext', async () => ({
    host: { id: 42 },
    subscription: null,
    accessMode: 'SUPPORT_READ_ONLY',
  }));

  await authMiddlewareModule.authMiddleware(request, response, () => {});

  assert.equal(request.user.id, 7);
  assert.equal(request.user.hostId, 42);
  assert.equal(request.user.isSuperAdmin, 1);
  assert.equal(request.authContext.originalHostId, 5);
  assert.equal(request.authContext.currentHostId, 42);
  assert.equal(request.authContext.accessMode, 'SUPPORT_READ_ONLY');
  assert.equal(request.body.hostId, 42);
  assert.equal(request.body.filter.hostId, 42);
});

test('switch access token with stale context version is rejected', async (context) => {
  const oldSecret = process.env.JWT_SECRET;
  context.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const request = makeRequest(signToken({
    userId: 7,
    tokenType: 'access',
    switchSessionId: 'switch-uuid',
    contextVersion: 2,
    authContext: 'ADMIN_SWITCH',
  }));
  request.originalUrl = '/api/v1/admin/switchUser';
  const response = createResponse();
  context.mock.method(userRepository, 'findById', async () => ({
    id: 7,
    hostId: 5,
    email: 'root@example.com',
    name: 'Root',
    roleId: 1,
    isSuperAdmin: 1,
    accountStatus: 'ACTIVE',
  }));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => ({
    switchSessionId: 'switch-uuid',
    userId: 7,
    contextVersion: 3,
  }));

  await authMiddlewareModule.authMiddleware(request, response, () => {
    assert.fail('Stale context must not continue');
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'INVALID_SWITCH_SESSION');
});

test('switch access token cannot authenticate Super Admin routes', async (context) => {
  const oldSecret = process.env.JWT_SECRET;
  context.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const request = makeRequest(signToken({
    userId: 7,
    tokenType: 'access',
    switchSessionId: 'switch-uuid',
    contextVersion: 3,
    authContext: 'ADMIN_SWITCH',
  }));
  const response = createResponse();

  await authMiddlewareModule.authMiddlewareSuperAdmin(request, response, () => {
    assert.fail('Switch token must not authenticate Super Admin routes');
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'INVALID_TOKEN');
});

test('switch access token cannot authenticate app routes through shared middleware', async (context) => {
  const oldSecret = process.env.JWT_SECRET;
  context.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const request = makeRequest(signToken({
    userId: 7,
    tokenType: 'access',
    switchSessionId: 'switch-uuid',
    contextVersion: 3,
    authContext: 'ADMIN_SWITCH',
  }));
  request.originalUrl = '/api/v1/app/attendance/get';
  const response = createResponse();
  context.mock.method(userRepository, 'findById', async () => ({
    id: 7,
    hostId: 5,
    email: 'root@example.com',
    name: 'Root',
    roleId: 1,
    isSuperAdmin: 1,
    accountStatus: 'ACTIVE',
  }));

  await authMiddlewareModule.authMiddleware(request, response, () => {
    assert.fail('Switch token must not authenticate app routes');
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'INVALID_TOKEN');
});

test('switchUser preserves its explicit target host while authenticating the current session', async (context) => {
  const oldSecret = process.env.JWT_SECRET;
  context.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const request = makeRequest(signToken({
    userId: 7,
    tokenType: 'access',
    switchSessionId: 'switch-uuid',
    contextVersion: 3,
    authContext: 'ADMIN_SWITCH',
  }));
  request.originalUrl = '/api/v1/admin/switchUser';
  request.body = { hostId: 42 };
  const response = createResponse();
  context.mock.method(userRepository, 'findById', async () => ({
    id: 7,
    hostId: 5,
    email: 'root@example.com',
    name: 'Root',
    roleId: 1,
    isSuperAdmin: 1,
    accountStatus: 'ACTIVE',
  }));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => ({
    switchSessionId: 'switch-uuid',
    userId: 7,
    originalHostId: 5,
    currentHostId: 41,
    sourceTokenFamily: 'source-family',
    contextVersion: 3,
  }));
  context.mock.method(refreshRepository, 'findActiveByFamily', async () => ({ id: 8 }));
  context.mock.method(hostService, 'getSwitchHostContext', async () => ({
    host: { id: 41 },
    subscription: null,
    accessMode: 'SUPPORT_READ_ONLY',
  }));

  await authMiddlewareModule.authMiddleware(request, response, () => {});

  assert.equal(request.user.hostId, 41);
  assert.equal(request.body.hostId, 42);
});

test('revoked original source session blocks existing switched access tokens', async (context) => {
  const oldSecret = process.env.JWT_SECRET;
  context.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const request = makeRequest(signToken({
    userId: 7,
    tokenType: 'access',
    switchSessionId: 'switch-uuid',
    contextVersion: 3,
    authContext: 'ADMIN_SWITCH',
  }));
  request.originalUrl = '/api/v1/admin/tasks/getTasks';
  const response = createResponse();
  context.mock.method(userRepository, 'findById', async () => ({
    id: 7,
    hostId: 5,
    email: 'root@example.com',
    name: 'Root',
    roleId: 1,
    isSuperAdmin: 1,
    accountStatus: 'ACTIVE',
  }));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => ({
    switchSessionId: 'switch-uuid',
    userId: 7,
    sourceTokenFamily: 'revoked-source',
    contextVersion: 3,
  }));
  context.mock.method(refreshRepository, 'findActiveByFamily', async () => null);

  await authMiddlewareModule.authMiddleware(request, response, () => {
    assert.fail('Revoked source session must invalidate support access');
  });

  assert.equal(response.statusCode, 401);
  assert.equal(response.body.code, 'INVALID_SWITCH_SESSION');
});