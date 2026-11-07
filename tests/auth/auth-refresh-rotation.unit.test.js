require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../src/models');
const authService = require('../../src/modules/auth/services/auth.service').default;
const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
const refreshTokenRepository = require('../../src/modules/auth/repositories/user-refresh-token.repository').default;

test.after(async () => {
  await models.sequelize.close();
});

const refreshPayload = { userId: 23, tokenFamily: 'family-23', tokenType: 'refresh' };
const issuedTokens = {
  accessToken: 'rotated-access',
  refreshToken: 'rotated-refresh',
  refreshTokenHash: 'rotated-hash',
  csrfToken: 'rotated-csrf',
  tokenFamily: 'family-23',
  sessionId: 'session-23',
};

function createUser(overrides = {}) {
  return {
    id: 23,
    hostId: 4,
    email: 'admin@example.com',
    name: 'Admin User',
    roleId: 2,
    accountStatus: 'ACTIVE',
    isAdminUser: 1,
    isSuperAdmin: 1,
    toJSON() {
      return { id: this.id, hostId: this.hostId, email: this.email };
    },
    ...overrides,
  };
}

function mockRotation(context, user) {
  context.mock.method(authService, 'verifyRefreshToken', () => refreshPayload);
  context.mock.method(userRepository, 'findById', async () => user);
  context.mock.method(userRepository, 'updateUserDeviceDetails', async () => ({}));
  context.mock.method(authService, 'generateUserSessionTokenBundle', (payload) => ({
    refreshTokenRecord: { hostId: user.hostId, userId: user.id, deviceId: payload.deviceId },
    sessionTokens: issuedTokens,
  }));
  context.mock.method(refreshTokenRepository, 'rotateByTokenHash', async (hash, expected, build) => {
    assert.ok(hash);
    assert.deepEqual(expected, { userId: user.id, tokenFamily: refreshPayload.tokenFamily });
    return { status: 'ROTATED', value: build({ deviceId: 'web-device' }).value };
  });
}

test('admin refresh retains the established response and rotates its existing session family', async (context) => {
  const user = createUser({ isSuperAdmin: 0 });
  mockRotation(context, user);
  const permissions = [];
  const subscription = { status: 'ACTIVE', canUseApp: true, isReadOnly: false, canRenew: false };
  context.mock.method(authService, 'getPermissionsByModuleForUser', async () => permissions);
  context.mock.method(authService, 'getSubscriptionStatusForHost', async () => subscription);

  const result = await authService.refreshAdminSession('old-refresh-token');

  assert.equal(result.user.id, user.id);
  assert.equal(result.accessToken, issuedTokens.accessToken);
  assert.equal(result.refreshToken, issuedTokens.refreshToken);
  assert.equal(result.csrfToken, issuedTokens.csrfToken);
  assert.deepEqual(result.permissionsByModule, permissions);
  assert.deepEqual(result.subscription, subscription);
});

test('Super Admin refresh preserves its existing response and original identity', async (context) => {
  const user = createUser({ isAdminUser: 0, isSuperAdmin: 1 });
  mockRotation(context, user);

  const result = await authService.refreshSuperAdminSession('old-refresh-token');

  assert.equal(result.user.id, user.id);
  assert.equal(result.user.hostId, user.hostId);
  assert.equal(result.accessToken, issuedTokens.accessToken);
  assert.equal(result.refreshToken, issuedTokens.refreshToken);
  assert.equal(result.csrfToken, issuedTokens.csrfToken);
});

test('a switched refresh token cannot be upgraded through Super Admin refresh', async (context) => {
  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: 23,
    tokenFamily: 'switch-family',
    tokenType: 'refresh',
    switchSessionId: 'switch-id',
    contextVersion: 1,
  }));

  await assert.rejects(
    authService.refreshSuperAdminSession('switch-refresh'),
    { code: 'INVALID_REFRESH_TOKEN' }
  );
});

test('a switched refresh token cannot be upgraded through app refresh', async (context) => {
  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: 23,
    tokenFamily: 'switch-family',
    tokenType: 'refresh',
    switchSessionId: 'switch-id',
    contextVersion: 1,
  }));

  await assert.rejects(
    authService.refreshAppSession('switch-refresh'),
    { code: 'INVALID_REFRESH_TOKEN' }
  );
});