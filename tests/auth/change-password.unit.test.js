require('ts-node/register/transpile-only');

process.env.JWT_REFRESH_SECRET = process.env.JWT_REFRESH_SECRET || 'test-refresh-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const bcrypt = require('bcryptjs');
const models = require('../../src/models');
const authService = require('../../src/modules/auth/services/auth.service').default;
const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
const userRefreshTokenRepository =
  require('../../src/modules/auth/repositories/user-refresh-token.repository').default;
const adminSwitchSessionRepository =
  require('../../src/modules/auth/repositories/admin-switch-session.repository').default;
const adminHostSwitchAuditRepository =
  require('../../src/modules/auth/repositories/admin-host-switch-audit.repository').default;

test.after(async () => {
  await models.sequelize.close();
});

const fakeTransaction = { LOCK: { UPDATE: 'UPDATE' } };
const CURRENT_PASSWORD = 'OldPass@123';
const NEW_PASSWORD = 'NewPass@456';
const USER_ID = 17;

const buildUser = (overrides = {}) => {
  const saveCalls = [];
  return {
    id: USER_ID,
    hostId: 3,
    accountStatus: 'ACTIVE',
    password: bcrypt.hashSync(CURRENT_PASSWORD, 10),
    passwordChangedAt: null,
    saveCalls,
    async save(options) {
      saveCalls.push({
        password: this.password,
        passwordChangedAt: this.passwordChangedAt,
        options,
      });
    },
    ...overrides,
  };
};

const signRefreshToken = (payload, options = {}) =>
  jwt.sign(
    { hostId: 3, tokenType: 'refresh', tokenFamily: 'family-current', userId: USER_ID, ...payload },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: '1h', ...options }
  );

const mockCommonDependencies = (context, overrides = {}) => {
  const calls = {
    revokeExceptFamily: [],
    revokeFamily: [],
    auditEntries: [],
    findByTokenHash: [],
    rotations: [],
  };

  context.mock.method(models.sequelize, 'transaction', async (callback) =>
    callback(fakeTransaction)
  );
  context.mock.method(
    userRepository,
    'findByIdWithPassword',
    overrides.findByIdWithPassword || (async () => buildUser())
  );
  context.mock.method(userRefreshTokenRepository, 'findByTokenHash', async (...args) => {
    calls.findByTokenHash.push(args);
    return overrides.tokenRecord !== undefined
      ? overrides.tokenRecord
      : {
          hostId: 3,
          userId: USER_ID,
          tokenFamily: 'family-current',
          deviceType: 'WEB',
          deviceId: 'default',
          isRevoked: 0,
          expiresAt: Math.floor(Date.now() / 1000) + 1000,
        };
  });
  context.mock.method(userRefreshTokenRepository, 'rotateByTokenHash', async (...args) => {
    calls.rotations.push(args);
    if (overrides.rotationResult) {
      return overrides.rotationResult;
    }
    return {
      status: 'ROTATED',
      value: {
        refreshTokenRecord: { deviceId: 'default' },
        sessionTokens: {
          accessToken: 'rotated-access-token',
          refreshToken: 'rotated-refresh-token',
          csrfToken: 'rotated-csrf-token',
        },
      },
    };
  });
  context.mock.method(
    userRefreshTokenRepository,
    'revokeActiveForUserExceptFamily',
    async (...args) => {
      calls.revokeExceptFamily.push(args);
    }
  );
  context.mock.method(userRefreshTokenRepository, 'revokeActiveForFamily', async (...args) => {
    calls.revokeFamily.push(args);
  });
  context.mock.method(
    adminSwitchSessionRepository,
    'findActiveByUser',
    overrides.findActiveByUser || (async () => [])
  );
  context.mock.method(adminHostSwitchAuditRepository, 'create', async (entry) => {
    calls.auditEntries.push(entry);
    return entry;
  });

  return calls;
};

test('an identified current session is preserved while other sessions are revoked', async (context) => {
  const user = buildUser();
  const calls = mockCommonDependencies(context, { findByIdWithPassword: async () => user });

  const sessionTokens = await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentRefreshToken: signRefreshToken({}),
  });

  assert.equal(user.saveCalls.length, 1);
  assert.equal(user.saveCalls[0].password, NEW_PASSWORD);
  assert.ok(user.saveCalls[0].passwordChangedAt > 0);
  assert.deepEqual(user.saveCalls[0].options, { transaction: fakeTransaction });
  assert.equal(calls.revokeExceptFamily.length, 1);
  assert.deepEqual(calls.revokeExceptFamily[0], [
    USER_ID,
    'family-current',
    fakeTransaction,
    'PASSWORD_CHANGED',
  ]);
  // The current session's credentials are rotated inside the transaction.
  assert.equal(calls.rotations.length, 1);
  assert.deepEqual(calls.rotations[0][1], { userId: USER_ID, tokenFamily: 'family-current' });
  assert.equal(calls.rotations[0][3], fakeTransaction);
  assert.equal(sessionTokens.accessToken, 'rotated-access-token');
});

test('a missing refresh token fails secure and revokes all sessions', async (context) => {
  const calls = mockCommonDependencies(context);

  const sessionTokens = await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
  });

  assert.equal(sessionTokens, null);
  assert.equal(calls.revokeExceptFamily.length, 1);
  assert.equal(calls.revokeExceptFamily[0][1], null);
  assert.equal(calls.findByTokenHash.length, 0);
  assert.equal(calls.rotations.length, 0);
});

test('an invalid or expired refresh token fails secure and revokes all sessions', async (context) => {
  const calls = mockCommonDependencies(context);

  await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentRefreshToken: signRefreshToken({}, { expiresIn: '-1s' }),
  });

  assert.equal(calls.revokeExceptFamily.length, 1);
  assert.equal(calls.revokeExceptFamily[0][1], null);
});

test("another user's refresh token is never used and never revokes that user's sessions", async (context) => {
  const calls = mockCommonDependencies(context);

  await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentRefreshToken: signRefreshToken({ userId: 99 }),
  });

  // The foreign token is rejected before any database lookup of its row.
  assert.equal(calls.findByTokenHash.length, 0);
  assert.equal(calls.revokeExceptFamily.length, 1);
  assert.equal(calls.revokeExceptFamily[0][0], USER_ID);
  assert.equal(calls.revokeExceptFamily[0][1], null);
});

test('a revoked or mismatched stored token record fails secure', async (context) => {
  const calls = mockCommonDependencies(context, {
    tokenRecord: {
      userId: USER_ID,
      tokenFamily: 'family-current',
      isRevoked: 1,
      expiresAt: Math.floor(Date.now() / 1000) + 1000,
    },
  });

  await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentRefreshToken: signRefreshToken({}),
  });

  assert.equal(calls.revokeExceptFamily[0][1], null);
});

test('active switch sessions are terminated with revocation and audit entries', async (context) => {
  const sessionUpdates = [];
  const buildSession = (id, tokenFamily) => ({
    id,
    switchSessionId: `switch-${id}`,
    userId: USER_ID,
    originalHostId: 3,
    currentHostId: 42,
    sourceTokenFamily: 'family-other-source',
    tokenFamily,
    contextVersion: 2,
    async update(values) {
      sessionUpdates.push({ id: this.id, values });
    },
  });
  const calls = mockCommonDependencies(context, {
    findActiveByUser: async () => [
      buildSession(1, 'support-family-a'),
      buildSession(2, 'support-family-b'),
    ],
  });

  await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentRefreshToken: signRefreshToken({}),
  });

  assert.equal(sessionUpdates.length, 2);
  assert.equal(sessionUpdates[0].values.isActive, 0);
  assert.ok(sessionUpdates[0].values.endedAt > 0);
  assert.deepEqual(
    calls.revokeFamily.map((call) => [call[1], call[3]]),
    [
      ['support-family-a', 'PASSWORD_CHANGED'],
      ['support-family-b', 'PASSWORD_CHANGED'],
    ]
  );
  assert.deepEqual(
    calls.auditEntries.map((entry) => entry.eventType),
    ['SESSION_TERMINATED', 'SESSION_TERMINATED']
  );
});

test('a switch session sourced from the preserved family is kept active', async (context) => {
  const sessionUpdates = [];
  const calls = mockCommonDependencies(context, {
    findActiveByUser: async () => [
      {
        id: 1,
        switchSessionId: 'switch-1',
        userId: USER_ID,
        originalHostId: 3,
        currentHostId: 42,
        sourceTokenFamily: 'family-current',
        tokenFamily: 'support-family-a',
        contextVersion: 1,
        async update(values) {
          sessionUpdates.push(values);
        },
      },
    ],
  });

  await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentRefreshToken: signRefreshToken({}),
  });

  assert.equal(sessionUpdates.length, 0);
  assert.equal(calls.revokeFamily.length, 0);
});

test('an incorrect current password rolls back without any revocation', async (context) => {
  const user = buildUser();
  const calls = mockCommonDependencies(context, { findByIdWithPassword: async () => user });

  await assert.rejects(
    authService.changePassword({
      userId: USER_ID,
      currentPassword: 'WrongPass@123',
      newPassword: NEW_PASSWORD,
      currentRefreshToken: signRefreshToken({}),
    }),
    (error) => error.code === 'CURRENT_PASSWORD_INCORRECT'
  );

  assert.equal(user.saveCalls.length, 0);
  assert.equal(calls.revokeExceptFamily.length, 0);
  assert.equal(calls.revokeFamily.length, 0);
});

test('a policy-violating new password rolls back without any revocation', async (context) => {
  const user = buildUser();
  const calls = mockCommonDependencies(context, { findByIdWithPassword: async () => user });

  await assert.rejects(
    authService.changePassword({
      userId: USER_ID,
      currentPassword: CURRENT_PASSWORD,
      newPassword: 'weakpass',
      currentRefreshToken: signRefreshToken({}),
    }),
    (error) => error.code === 'PASSWORD_POLICY_VIOLATION'
  );

  assert.equal(user.saveCalls.length, 0);
  assert.equal(calls.revokeExceptFamily.length, 0);
});

test('a revocation failure rejects so the surrounding transaction rolls back', async (context) => {
  const user = buildUser();
  mockCommonDependencies(context, { findByIdWithPassword: async () => user });
  context.mock.method(userRefreshTokenRepository, 'revokeActiveForUserExceptFamily', async () => {
    throw new Error('revocation failed');
  });

  await assert.rejects(
    authService.changePassword({
      userId: USER_ID,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      currentRefreshToken: signRefreshToken({}),
    }),
    /revocation failed/
  );
});

test('a failed current-session rotation falls back to revoking that family too', async (context) => {
  const calls = mockCommonDependencies(context, { rotationResult: { status: 'REPLAY' } });

  const sessionTokens = await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentRefreshToken: signRefreshToken({}),
  });

  assert.equal(sessionTokens, null);
  assert.deepEqual(
    calls.revokeFamily.map((call) => [call[1], call[3]]),
    [['family-current', 'PASSWORD_CHANGED']]
  );
});

test('a deadlock retries the complete transaction exactly once and succeeds', async (context) => {
  const calls = mockCommonDependencies(context);
  let attempts = 0;
  context.mock.method(models.sequelize, 'transaction', async (callback) => {
    attempts += 1;
    if (attempts === 1) {
      const error = new Error('Deadlock found when trying to get lock');
      error.parent = { code: 'ER_LOCK_DEADLOCK' };
      throw error;
    }
    return callback(fakeTransaction);
  });

  const sessionTokens = await authService.changePassword({
    userId: USER_ID,
    currentPassword: CURRENT_PASSWORD,
    newPassword: NEW_PASSWORD,
    currentRefreshToken: signRefreshToken({}),
  });

  assert.equal(attempts, 2);
  assert.equal(calls.revokeExceptFamily.length, 1);
  assert.equal(sessionTokens.accessToken, 'rotated-access-token');
});

test('a second consecutive deadlock fails safely without further retries', async (context) => {
  mockCommonDependencies(context);
  let attempts = 0;
  context.mock.method(models.sequelize, 'transaction', async () => {
    attempts += 1;
    const error = new Error('Deadlock found when trying to get lock');
    error.parent = { code: 'ER_LOCK_DEADLOCK' };
    throw error;
  });

  await assert.rejects(
    authService.changePassword({
      userId: USER_ID,
      currentPassword: CURRENT_PASSWORD,
      newPassword: NEW_PASSWORD,
      currentRefreshToken: signRefreshToken({}),
    }),
    /Deadlock/
  );
  assert.equal(attempts, 2);
});

test('validation failures are never retried as deadlocks', async (context) => {
  let attempts = 0;
  const user = buildUser();
  mockCommonDependencies(context, { findByIdWithPassword: async () => user });
  context.mock.method(models.sequelize, 'transaction', async (callback) => {
    attempts += 1;
    return callback(fakeTransaction);
  });

  await assert.rejects(
    authService.changePassword({
      userId: USER_ID,
      currentPassword: 'WrongPass@123',
      newPassword: NEW_PASSWORD,
      currentRefreshToken: signRefreshToken({}),
    }),
    (error) => error.code === 'CURRENT_PASSWORD_INCORRECT'
  );
  assert.equal(attempts, 1);
});

test('tokens revoked by a password change stay dead on replay through rotation', async (context) => {
  const UserRefreshToken = models.UserRefreshToken;
  const now = Math.floor(Date.now() / 1000);
  const revokedRow = {
    id: 5,
    userId: USER_ID,
    tokenFamily: 'family-other',
    tokenHash: 'revoked-by-password-change',
    isRevoked: 1,
    expiresAt: now + 1000,
    async update() {},
  };
  const familyRevocations = [];

  context.mock.method(UserRefreshToken, 'findOne', async () => revokedRow);
  context.mock.method(UserRefreshToken, 'update', async (values, options) => {
    familyRevocations.push({ values, options });
    return [1];
  });

  const result = await userRefreshTokenRepository.rotateByTokenHash(
    'revoked-by-password-change',
    { userId: USER_ID, tokenFamily: 'family-other' },
    () => ({ data: {}, value: {} }),
    fakeTransaction
  );

  assert.equal(result.status, 'REPLAY');
  assert.equal(familyRevocations.length, 1);
  assert.equal(familyRevocations[0].options.where.tokenFamily, 'family-other');
});
