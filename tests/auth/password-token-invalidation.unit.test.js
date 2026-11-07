require('ts-node/register/transpile-only');

process.env.JWT_SECRET = process.env.JWT_SECRET || 'test-access-secret';
process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';
process.env.JWT_EXPIRES_IN_WEB = '7d';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const models = require('../../src/models');
const User = require('../../src/models/schemas/User').default;
const UserRefreshToken = require('../../src/models/schemas/UserRefreshToken').default;
const authService = require('../../src/modules/auth/services/auth.service').default;
const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
const userRefreshTokenRepository =
  require('../../src/modules/auth/repositories/user-refresh-token.repository').default;
const {
  authMiddleware,
  authMiddlewareSuperAdmin,
} = require('../../src/shared/middleware/auth.middleware');

test.after(async () => {
  await models.sequelize.close();
});

const USER_ID = 17;
const fakeTransaction = { LOCK: { UPDATE: 'UPDATE' } };

const buildAccessToken = (claims = {}) =>
  jwt.sign({ userId: USER_ID, tokenType: 'access', sessionId: 'session-1', ...claims }, process.env.JWT_SECRET, {
    expiresIn: '1h',
  });

const buildUser = (overrides = {}) => ({
  id: USER_ID,
  hostId: 3,
  email: 'user@example.com',
  name: 'User',
  roleId: 2,
  isFieldAppUser: 1,
  isAdminUser: 1,
  isSuperAdmin: 0,
  accountStatus: 'ACTIVE',
  passwordChangedAt: null,
  ...overrides,
});

const buildResponse = () => {
  const result = { statusCode: null, body: null, headers: {} };
  return {
    result,
    setHeader(key, value) {
      result.headers[key] = value;
    },
    status(code) {
      result.statusCode = code;
      return this;
    },
    json(body) {
      result.body = body;
    },
  };
};

const runAuthMiddleware = async (context, middleware, token, user) => {
  context.mock.method(userRepository, 'findById', async () => user);
  const req = {
    headers: { authorization: `Bearer ${token}` },
    cookies: {},
    originalUrl: '/api/v1/app/profile/get',
    baseUrl: '/api/v1/app',
  };
  const res = buildResponse();
  let nextCalled = false;
  await middleware(req, res, () => {
    nextCalled = true;
  });
  return { nextCalled, res: res.result, req };
};

// --- Access-token invalidation via passwordChangedAt ---

test('legacy tokens keep working for users who never changed their password', async (context) => {
  const outcome = await runAuthMiddleware(context, authMiddleware, buildAccessToken(), buildUser());
  assert.equal(outcome.nextCalled, true);
});

test('a token without the claim is rejected once the password has changed', async (context) => {
  const outcome = await runAuthMiddleware(
    context,
    authMiddleware,
    buildAccessToken(),
    buildUser({ passwordChangedAt: 1_800_000_000 })
  );
  assert.equal(outcome.nextCalled, false);
  assert.equal(outcome.res.statusCode, 401);
  assert.equal(outcome.res.body.code, 'INVALID_TOKEN');
});

test('a token carrying an older password generation is rejected', async (context) => {
  const outcome = await runAuthMiddleware(
    context,
    authMiddleware,
    buildAccessToken({ passwordChangedAt: 1_799_999_990 }),
    buildUser({ passwordChangedAt: 1_800_000_000 })
  );
  assert.equal(outcome.nextCalled, false);
  assert.equal(outcome.res.statusCode, 401);
});

test('a token issued in the same second as the change is valid only with the matching claim', async (context) => {
  const changedAt = 1_800_000_000;
  const sameSecondWithClaim = await runAuthMiddleware(
    context,
    authMiddleware,
    buildAccessToken({ passwordChangedAt: changedAt }),
    buildUser({ passwordChangedAt: changedAt })
  );
  assert.equal(sameSecondWithClaim.nextCalled, true);

  const sameSecondWithoutClaim = await runAuthMiddleware(
    context,
    authMiddleware,
    jwt.sign(
      { userId: USER_ID, tokenType: 'access', sessionId: 's', iat: changedAt },
      process.env.JWT_SECRET,
      { expiresIn: '1h' }
    ),
    buildUser({ passwordChangedAt: changedAt })
  );
  assert.equal(sameSecondWithoutClaim.nextCalled, false);
  assert.equal(sameSecondWithoutClaim.res.statusCode, 401);
});

test('super admin middleware applies the same password-generation rule', async (context) => {
  const rejected = await runAuthMiddleware(
    context,
    authMiddlewareSuperAdmin,
    buildAccessToken({ passwordChangedAt: 10 }),
    buildUser({ isSuperAdmin: 1, passwordChangedAt: 20 })
  );
  assert.equal(rejected.nextCalled, false);
  assert.equal(rejected.res.statusCode, 401);

  const accepted = await runAuthMiddleware(
    context,
    authMiddlewareSuperAdmin,
    buildAccessToken({ passwordChangedAt: 20 }),
    buildUser({ isSuperAdmin: 1, passwordChangedAt: 20 })
  );
  assert.equal(accepted.nextCalled, true);
});

test('switched-host tokens are not subject to the plain-token password check', async (context) => {
  // A switch token reaching a non-admin path is rejected by the dedicated
  // switch branch (path restriction), never by the password-generation rule.
  const outcome = await runAuthMiddleware(
    context,
    authMiddleware,
    buildAccessToken({ authContext: 'ADMIN_SWITCH', switchSessionId: 'sw-1', contextVersion: 1 }),
    buildUser({ isSuperAdmin: 1, passwordChangedAt: 1_800_000_000 })
  );
  assert.equal(outcome.nextCalled, false);
  assert.equal(outcome.res.body.code, 'INVALID_TOKEN');
});

// --- Account status ---

test('a deactivated account cannot use an otherwise valid access token', async (context) => {
  const outcome = await runAuthMiddleware(
    context,
    authMiddleware,
    buildAccessToken(),
    buildUser({ accountStatus: 'INACTIVE' })
  );
  assert.equal(outcome.nextCalled, false);
  assert.equal(outcome.res.statusCode, 403);
  assert.equal(outcome.res.body.code, 'ACCOUNT_INACTIVE');
});

test('an active account continues working', async (context) => {
  const outcome = await runAuthMiddleware(context, authMiddleware, buildAccessToken(), buildUser());
  assert.equal(outcome.nextCalled, true);
  assert.equal(outcome.req.user.id, USER_ID);
});

// --- Seven-day expiry preserved; new tokens carry the claim ---

test('issued web access tokens keep the configured 7-day expiry and carry the claim', () => {
  const token = authService.generateAccessToken(USER_ID, 'WEB', 'session-1', undefined, 1234);
  const decoded = jwt.decode(token);
  assert.equal(decoded.exp - decoded.iat, 7 * 24 * 60 * 60);
  assert.equal(decoded.passwordChangedAt, 1234);
});

test('issued tokens default to password generation 0 when none is provided', () => {
  const token = authService.generateAccessToken(USER_ID, 'WEB', 'session-1');
  assert.equal(jwt.decode(token).passwordChangedAt, 0);
});

// --- Login race protection in replaceForDevice ---

const mockReplaceForDevice = (context, lockedUserPassword) => {
  const writes = { created: null, updated: null };
  context.mock.method(UserRefreshToken.sequelize, 'transaction', async (callback) =>
    callback(fakeTransaction)
  );
  context.mock.method(User, 'findByPk', async () => ({ password: lockedUserPassword }));
  context.mock.method(UserRefreshToken, 'findOne', async () => null);
  context.mock.method(UserRefreshToken, 'create', async (values) => {
    writes.created = values;
    return values;
  });
  return writes;
};

const refreshRecord = {
  hostId: 3,
  userId: USER_ID,
  tokenHash: 'hash-1',
  tokenFamily: 'family-1',
  deviceType: 'WEB',
  deviceId: 'default',
  expiresAt: Math.floor(Date.now() / 1000) + 100,
};

test('login is rejected when the password hash changed after credential validation', async (context) => {
  mockReplaceForDevice(context, 'hash-after-change');

  await assert.rejects(
    userRefreshTokenRepository.replaceForDevice(refreshRecord, 'hash-at-validation'),
    (error) => error.code === 'INVALID_CREDENTIALS'
  );
});

test('login proceeds when the password hash is unchanged under the user lock', async (context) => {
  const writes = mockReplaceForDevice(context, 'hash-at-validation');

  await userRefreshTokenRepository.replaceForDevice(refreshRecord, 'hash-at-validation');
  assert.equal(writes.created.tokenHash, 'hash-1');
});

test('flows without an expected hash (e.g. OTP login) skip the comparison', async (context) => {
  const writes = mockReplaceForDevice(context, 'any-current-hash');

  await userRefreshTokenRepository.replaceForDevice(refreshRecord, undefined);
  assert.equal(writes.created.tokenHash, 'hash-1');
});

// --- Login flows thread the expected hash; OTP path does not ---

test('adminLogin threads the validated password hash and generation into session creation', async (context) => {
  const user = {
    id: USER_ID,
    hostId: 3,
    roleId: 2,
    isAdminUser: 1,
    password: 'validated-hash',
    passwordChangedAt: 555,
    toJSON: () => ({ id: USER_ID }),
  };
  let capturedPayload;
  context.mock.method(authService, 'validateCredentials', async () => user);
  context.mock.method(authService, 'getSubscriptionStatusForHost', async () => ({}));
  context.mock.method(authService, 'getPermissionsByModuleForUser', async () => []);
  context.mock.method(authService, 'createUserSessionTokens', async (payload) => {
    capturedPayload = payload;
    return { accessToken: 'a', refreshToken: 'r', csrfToken: 'c' };
  });

  await authService.adminLogin({ email: 'user@example.com', password: 'OldPass@123' });

  assert.equal(capturedPayload.expectedPasswordHash, 'validated-hash');
  assert.equal(capturedPayload.passwordChangedAt, 555);
});

test('old password is rejected and new password accepted after a change', async (context) => {
  const bcrypt = require('bcryptjs');
  const user = {
    id: USER_ID,
    hostId: 3,
    accountStatus: 'ACTIVE',
    isFieldAppUser: 1,
    password: bcrypt.hashSync('NewPass@456', 10),
  };
  context.mock.method(userRepository, 'findWithPassword', async () => user);
  context.mock.method(authService, 'buildAppLoginResponse', async () => ({ ok: true }));

  await assert.rejects(
    authService.login({ email: 'user@example.com', password: 'OldPass@123' }),
    (error) => error.code === 'INVALID_CREDENTIALS'
  );

  const result = await authService.login({ email: 'user@example.com', password: 'NewPass@456' });
  assert.deepEqual(result, { ok: true });
});
