require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const jwt = require('jsonwebtoken');
const models = require('../../src/models');
const authService = require('../../src/modules/auth/services/auth.service').default;
const hostService = require('../../src/modules/master/services/host.service').default;
const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
const refreshRepository = require('../../src/modules/auth/repositories/user-refresh-token.repository').default;
const handoffRepository = require('../../src/modules/auth/repositories/admin-switch-handoff.repository').default;
const switchSessionRepository = require('../../src/modules/auth/repositories/admin-switch-session.repository').default;
const auditRepository = require('../../src/modules/auth/repositories/admin-host-switch-audit.repository').default;
const roleRepository = require('../../src/modules/auth/repositories/role.repository').default;

test.after(async () => {
  await models.sequelize.close();
});

function createTransaction() {
  return { LOCK: { UPDATE: 'UPDATE' } };
}

function createSuperAdmin() {
  return {
    id: 81,
    hostId: 5,
    email: 'root@example.com',
    name: 'Root Admin',
    roleId: 1,
    accountStatus: 'ACTIVE',
    isSuperAdmin: 1,
    isAdminUser: 0,
    toJSON() {
      return { id: this.id, hostId: this.hostId, email: this.email };
    },
  };
}

function createTokens(payload) {
  return {
    refreshTokenRecord: {
      hostId: payload.hostId,
      userId: payload.userId,
      tokenHash: `hash-${payload.contextVersion || 1}`,
      tokenFamily: payload.tokenFamily || 'switch-family',
      deviceType: 'WEB',
      deviceId: payload.deviceId,
      expiresAt: 4_000_000_000,
      switchSessionId: payload.switchSessionId,
      contextVersion: payload.contextVersion,
    },
    sessionTokens: {
      accessToken: `access-${payload.contextVersion || 1}`,
      refreshToken: `refresh-${payload.contextVersion || 1}`,
      refreshTokenHash: `hash-${payload.contextVersion || 1}`,
      tokenFamily: payload.tokenFamily || 'switch-family',
      csrfToken: 'csrf-token',
      sessionId: 'access-session-id',
      switchSessionId: payload.switchSessionId,
      contextVersion: payload.contextVersion,
    },
  };
}

function mockSupportPermissions(context) {
  context.mock.method(roleRepository, 'findActiveByHostAndCode', async () => ({ id: 6 }));
  context.mock.method(authService, 'getPermissionsByModuleForUser', async () => []);
}

test('handoff creates the switch session with original identity and read-only host context', async (context) => {
  mockSupportPermissions(context);
  const transaction = createTransaction();
  const user = createSuperAdmin();
  const handoff = {
    userId: user.id,
    tokenFamily: 'original-family',
    expiresAt: Math.floor(Date.now() / 1000) + 60,
    consumedAt: null,
    async update(values) { Object.assign(this, values); },
  };
  let createdSession;
  let auditEvent;
  let handoffHash;

  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(handoffRepository, 'findByTokenHash', async (hash) => {
    handoffHash = hash;
    return handoff;
  });
  context.mock.method(refreshRepository, 'findActiveByFamily', async (userId, tokenFamily) => {
    assert.equal(userId, user.id);
    assert.equal(tokenFamily, 'original-family');
    return { id: 8 };
  });
  context.mock.method(userRepository, 'findById', async () => user);
  context.mock.method(hostService, 'getSwitchHostContext', async () => ({
    host: { id: 42, companyName: 'Host B' },
    subscription: null,
    accessMode: 'SUPPORT_READ_ONLY',
  }));
  context.mock.method(authService, 'generateUserSessionTokenBundle', createTokens);
  context.mock.method(authService, 'generateRefreshRecordForSwitchSession', (_tokens, hostId, userId, tokenFamily, deviceId, contextVersion) => ({
    hostId,
    userId,
    tokenHash: `hash-${contextVersion}`,
    tokenFamily,
    deviceType: 'WEB',
    deviceId,
    expiresAt: 4_000_000_000,
    switchSessionId: 'switch-session-id',
    contextVersion,
  }));
  context.mock.method(switchSessionRepository, 'create', async (data) => {
    createdSession = { ...data, id: 19 };
    return createdSession;
  });
  context.mock.method(switchSessionRepository, 'update', async (session, values) => {
    Object.assign(session, values);
  });
  context.mock.method(refreshRepository, 'create', async () => ({ id: 27 }));
  context.mock.method(auditRepository, 'create', async (data) => {
    auditEvent = data;
    return data;
  });

  const result = await authService.switchAdminHost(42, { handoffToken: 'secret-handoff' });

  assert.notEqual(handoffHash, 'secret-handoff');
  assert.equal(handoff.consumedAt > 0, true);
  assert.equal(createdSession.userId, user.id);
  assert.equal(createdSession.originalHostId, user.hostId);
  assert.equal(createdSession.sourceTokenFamily, 'original-family');
  assert.equal(createdSession.currentHostId, 42);
  assert.equal(result.user.id, user.id);
  assert.equal(result.host.id, 42);
  assert.equal(result.accessMode, 'SUPPORT_READ_ONLY');
  assert.equal(result.switchSession.contextVersion, 1);
  assert.equal(auditEvent.originalUserId, user.id);
  assert.equal(auditEvent.previousHostId, null);
  assert.equal(auditEvent.newHostId, 42);
  assert.equal('refreshToken' in auditEvent, false);
});

test('switching from Host A to Host B keeps the original Super Admin and increments context version', async (context) => {
  mockSupportPermissions(context);
  const transaction = createTransaction();
  const user = createSuperAdmin();
  const session = {
    switchSessionId: 'switch-session-id',
    userId: user.id,
    originalHostId: user.hostId,
    currentHostId: 41,
    tokenFamily: 'switch-family',
    deviceId: 'support-device',
    contextVersion: 4,
  };
  let expected;
  let replacement;
  let auditEvent;

  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => session);
  context.mock.method(refreshRepository, 'findActiveByFamily', async () => ({ id: 8 }));
  context.mock.method(userRepository, 'findById', async () => user);
  context.mock.method(hostService, 'getSwitchHostContext', async () => ({
    host: { id: 42 },
    subscription: { paymentStatus: 'PAID' },
    accessMode: 'SUPPORT_FULL',
  }));
  context.mock.method(authService, 'generateUserSessionTokenBundle', createTokens);
  context.mock.method(refreshRepository, 'replaceForSwitchSession', async (expectedValue, data) => {
    expected = expectedValue;
    replacement = data;
    return { status: 'REPLACED', record: { id: 27 } };
  });
  context.mock.method(switchSessionRepository, 'update', async (_session, values) => {
    Object.assign(session, values);
  });
  context.mock.method(auditRepository, 'create', async (data) => {
    auditEvent = data;
    return data;
  });

  const result = await authService.switchAdminHost(42, {
    userId: user.id,
    switchSessionId: session.switchSessionId,
    contextVersion: 4,
  });

  assert.equal(expected.contextVersion, 4);
  assert.equal(replacement.contextVersion, 5);
  assert.equal(session.currentHostId, 42);
  assert.equal(session.contextVersion, 5);
  assert.equal(result.user.id, user.id);
  assert.equal(result.host.id, 42);
  assert.equal(result.accessMode, 'SUPPORT_FULL');
  assert.equal(auditEvent.previousHostId, 41);
  assert.equal(auditEvent.newHostId, 42);
  assert.equal(auditEvent.contextVersion, 5);
});

test('switch refresh preserves principal and advances context version', async (context) => {
  mockSupportPermissions(context);
  const transaction = createTransaction();
  const user = createSuperAdmin();
  const session = {
    switchSessionId: 'switch-session-id',
    userId: user.id,
    originalHostId: user.hostId,
    currentHostId: 42,
    tokenFamily: 'switch-family',
    deviceId: 'support-device',
    contextVersion: 3,
    currentRefreshTokenId: 27,
  };
  let rotationExpected;
  let replacement;

  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: user.id,
    tokenFamily: session.tokenFamily,
    tokenType: 'refresh',
    switchSessionId: session.switchSessionId,
    contextVersion: 3,
  }));
  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => session);
  context.mock.method(refreshRepository, 'findActiveByFamily', async () => ({ id: 8 }));
  context.mock.method(userRepository, 'findById', async () => user);
  context.mock.method(hostService, 'getSwitchHostContext', async () => ({
    host: { id: 42 },
    subscription: null,
    accessMode: 'SUPPORT_READ_ONLY',
  }));
  context.mock.method(authService, 'generateUserSessionTokenBundle', createTokens);
  context.mock.method(refreshRepository, 'rotateByTokenHash', async (_hash, expected, build) => {
    rotationExpected = expected;
    const built = build({ deviceId: session.deviceId });
    replacement = built.data;
    return { status: 'ROTATED', value: built.value };
  });
  context.mock.method(switchSessionRepository, 'update', async (_session, values) => {
    Object.assign(session, values);
  });

  const result = await authService.refreshAdminSession('old-refresh-token');

  assert.equal(rotationExpected.userId, user.id);
  assert.equal(rotationExpected.switchSessionId, session.switchSessionId);
  assert.equal(rotationExpected.contextVersion, 3);
  assert.equal(replacement.contextVersion, 4);
  assert.equal(session.contextVersion, 4);
  assert.equal(result.user.id, user.id);
  assert.equal(result.host.id, 42);
  assert.equal(result.accessMode, 'SUPPORT_READ_ONLY');
});

test('switch refresh replay terminates the session and commits the audit event', async (context) => {
  const transaction = createTransaction();
  const user = createSuperAdmin();
  const session = {
    switchSessionId: 'switch-session-id',
    userId: user.id,
    originalHostId: user.hostId,
    currentHostId: 42,
    tokenFamily: 'switch-family',
    deviceId: 'support-device',
    contextVersion: 3,
    async update(values) { Object.assign(this, values); },
  };
  let auditEvent;

  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: user.id,
    tokenFamily: session.tokenFamily,
    tokenType: 'refresh',
    switchSessionId: session.switchSessionId,
    contextVersion: 3,
  }));
  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => session);
  context.mock.method(refreshRepository, 'findActiveByFamily', async () => ({ id: 8 }));
  context.mock.method(userRepository, 'findById', async () => user);
  context.mock.method(hostService, 'getSwitchHostContext', async () => ({
    host: { id: 42 },
    subscription: null,
    accessMode: 'SUPPORT_READ_ONLY',
  }));
  context.mock.method(refreshRepository, 'rotateByTokenHash', async () => ({ status: 'REPLAY' }));
  context.mock.method(refreshRepository, 'revokeActiveForFamily', async () => undefined);
  context.mock.method(auditRepository, 'create', async (data) => {
    auditEvent = data;
    return data;
  });

  await assert.rejects(
    authService.refreshAdminSession('reused-refresh-token'),
    { code: 'REFRESH_TOKEN_REUSE_DETECTED' }
  );

  assert.equal(session.isActive, 0);
  assert.equal(auditEvent.eventType, 'SESSION_TERMINATED');
  assert.equal(auditEvent.originalUserId, user.id);
});

test('switch logout without a refresh cookie terminates the active session immediately', async (context) => {
  const oldSecret = process.env.JWT_SECRET;
  process.env.JWT_SECRET = 'switch-logout-test-secret';
  context.after(() => {
    if (oldSecret === undefined) delete process.env.JWT_SECRET;
    else process.env.JWT_SECRET = oldSecret;
  });
  const transaction = createTransaction();
  const session = {
    switchSessionId: 'switch-session-id',
    userId: 81,
    originalHostId: 5,
    currentHostId: 42,
    tokenFamily: 'switch-family',
    contextVersion: 6,
    async update(values) { Object.assign(this, values); },
  };
  const accessToken = jwt.sign({
    userId: 81,
    tokenType: 'access',
    authContext: 'ADMIN_SWITCH',
    switchSessionId: session.switchSessionId,
    contextVersion: 6,
  }, process.env.JWT_SECRET, { expiresIn: '5m' });

  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => session);
  const revokedFamilies = [];
  context.mock.method(refreshRepository, 'revokeActiveForFamily', async (...args) => {
    revokedFamilies.push(args.slice(0, 2));
  });
  context.mock.method(auditRepository, 'create', async (data) => data);

  await authService.logoutAdminSession(undefined, accessToken);

  assert.equal(session.isActive, 0);
  assert.ok(session.endedAt);
  assert.deepEqual(revokedFamilies, [[81, 'switch-family']]);
});

test('Super Admin source logout terminates every linked switch session and only that source family', async (context) => {
  const transaction = createTransaction();
  const user = createSuperAdmin();
  const sessions = [
    {
      switchSessionId: 'switch-a', userId: user.id, originalHostId: user.hostId,
      currentHostId: 41, sourceTokenFamily: 'source-a', tokenFamily: 'derived-a',
      contextVersion: 2, async update(values) { Object.assign(this, values); },
    },
    {
      switchSessionId: 'switch-b', userId: user.id, originalHostId: user.hostId,
      currentHostId: 42, sourceTokenFamily: 'source-a', tokenFamily: 'derived-b',
      contextVersion: 5, async update(values) { Object.assign(this, values); },
    },
  ];
  const revokedFamilies = [];
  const auditEvents = [];
  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: user.id,
    hostId: user.hostId,
    tokenFamily: 'source-a',
    tokenType: 'refresh',
  }));
  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(refreshRepository, 'findActiveByFamily', async (userId, family, tx, lock) => {
    assert.equal(userId, user.id);
    assert.equal(family, 'source-a');
    assert.equal(tx, transaction);
    assert.equal(lock, true);
    return { userId: user.id, hostId: user.hostId, deviceType: 'WEB' };
  });
  context.mock.method(refreshRepository, 'revokeActiveForFamily', async (userId, tokenFamily) => {
    revokedFamilies.push([userId, tokenFamily]);
  });
  context.mock.method(switchSessionRepository, 'findActiveBySourceSession', async (userId, family, tx) => {
    assert.equal(userId, user.id);
    assert.equal(family, 'source-a');
    assert.equal(tx, transaction);
    return sessions;
  });
  context.mock.method(auditRepository, 'create', async (event) => {
    auditEvents.push(event);
    return event;
  });

  await authService.logoutSuperAdminSession('source-refresh-token');

  assert.equal(sessions.every((session) => session.isActive === 0), true);
  assert.deepEqual(revokedFamilies, [
    [user.id, 'source-a'],
    [user.id, 'derived-a'],
    [user.id, 'derived-b'],
  ]);
  assert.equal(auditEvents.length, 2);
  assert.deepEqual(auditEvents.map((event) => event.switchSessionId), ['switch-a', 'switch-b']);
});

test('source logout does not terminate derived sessions belonging to another device family', async (context) => {
  const transaction = createTransaction();
  const user = createSuperAdmin();
  const otherSession = {
    switchSessionId: 'switch-other', userId: user.id, originalHostId: user.hostId,
    currentHostId: 43, sourceTokenFamily: 'source-b', tokenFamily: 'derived-b',
    contextVersion: 1, async update(values) { Object.assign(this, values); },
  };
  let queriedFamily;
  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: user.id,
    hostId: user.hostId,
    tokenFamily: 'source-a',
    tokenType: 'refresh',
  }));
  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(refreshRepository, 'findActiveByFamily', async () => ({
    userId: user.id,
    hostId: user.hostId,
    deviceType: 'WEB',
  }));
  context.mock.method(refreshRepository, 'revokeActiveForFamily', async () => undefined);
  context.mock.method(switchSessionRepository, 'findActiveBySourceSession', async (_userId, family) => {
    queriedFamily = family;
    return [];
  });

  await authService.logoutSuperAdminSession('source-a-refresh-token');

  assert.equal(queriedFamily, 'source-a');
  assert.equal(otherSession.isActive, undefined);
});

test('switch session refresh ends immediately when the original source family is revoked', async (context) => {
  const transaction = createTransaction();
  const user = createSuperAdmin();
  const session = {
    switchSessionId: 'switch-id',
    userId: user.id,
    originalHostId: user.hostId,
    sourceTokenFamily: 'revoked-source-family',
    currentHostId: 41,
    tokenFamily: 'derived-family',
    deviceId: 'support-device',
    contextVersion: 1,
    async update(values) { Object.assign(this, values); },
  };

  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: user.id,
    tokenFamily: session.tokenFamily,
    tokenType: 'refresh',
    switchSessionId: session.switchSessionId,
    contextVersion: 1,
  }));
  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(switchSessionRepository, 'findBySwitchSessionId', async () => session);
  context.mock.method(userRepository, 'findById', async () => user);
  context.mock.method(refreshRepository, 'findActiveByFamily', async () => null);
  context.mock.method(refreshRepository, 'revokeActiveForFamily', async () => undefined);
  context.mock.method(auditRepository, 'create', async (event) => event);

  await assert.rejects(
    authService.refreshAdminSession('derived-refresh'),
    { code: 'SUPER_ADMIN_ACCESS_REQUIRED' }
  );

  assert.equal(session.isActive, 0);
  assert.equal(session.endedAt > 0, true);
});

test('invalid host IDs are rejected before creating a switch session', async () => {
  await assert.rejects(
    authService.switchAdminHost(0, { handoffToken: 'unused-handoff' }),
    { code: 'INVALID_HOST_ID' }
  );
});

test('consumed handoff cannot create another switch session', async (context) => {
  const transaction = createTransaction();
  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(handoffRepository, 'findByTokenHash', async () => ({
    userId: 81,
    expiresAt: Math.floor(Date.now() / 1000) + 60,
    consumedAt: Math.floor(Date.now() / 1000) - 1,
  }));

  await assert.rejects(
    authService.switchAdminHost(42, { handoffToken: 'already-consumed-handoff' }),
    { code: 'INVALID_SWITCH_HANDOFF' }
  );
});

test('handoff issuance requires and hashes the active Super Admin refresh token', async (context) => {
  const user = createSuperAdmin();
  let createdHandoff;
  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: user.id,
    hostId: user.hostId,
    tokenFamily: 'original-family',
    tokenType: 'refresh',
  }));
  context.mock.method(refreshRepository, 'findByTokenHash', async () => ({
    userId: user.id,
    hostId: user.hostId,
    tokenFamily: 'original-family',
    deviceType: 'WEB',
    isRevoked: 0,
    expiresAt: Math.floor(Date.now() / 1000) + 60,
  }));
  context.mock.method(userRepository, 'findById', async () => user);
  context.mock.method(handoffRepository, 'create', async (data) => {
    createdHandoff = data;
    return data;
  });

  const result = await authService.createAdminSwitchHandoff(user.id, 'active-refresh-token');

  assert.notEqual(createdHandoff.tokenHash, 'active-refresh-token');
  assert.equal(createdHandoff.userId, user.id);
  assert.equal(createdHandoff.expiresAt > Math.floor(Date.now() / 1000), true);
  assert.equal(typeof result.csrfToken, 'string');
  assert.equal('handoffToken' in result, true);
});

test('handoff issuance rejects a revoked Super Admin refresh record', async (context) => {
  const user = createSuperAdmin();
  let handoffCreated = false;
  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: user.id,
    tokenFamily: 'original-family',
    tokenType: 'refresh',
  }));
  context.mock.method(refreshRepository, 'findByTokenHash', async () => ({
    userId: user.id,
    tokenFamily: 'original-family',
    isRevoked: 1,
    expiresAt: Math.floor(Date.now() / 1000) + 60,
  }));
  context.mock.method(handoffRepository, 'create', async () => {
    handoffCreated = true;
  });

  await assert.rejects(
    authService.createAdminSwitchHandoff(user.id, 'revoked-refresh-token'),
    { code: 'INVALID_REFRESH_TOKEN' }
  );

  assert.equal(handoffCreated, false);
});

test('a logged-out source refresh family cannot consume an issued handoff', async (context) => {
  const transaction = createTransaction();
  context.mock.method(models.sequelize, 'transaction', async (callback) => callback(transaction));
  context.mock.method(handoffRepository, 'findByTokenHash', async () => ({
    userId: 81,
    tokenFamily: 'logged-out-family',
    expiresAt: Math.floor(Date.now() / 1000) + 60,
    consumedAt: null,
  }));
  context.mock.method(refreshRepository, 'findActiveByFamily', async () => null);

  await assert.rejects(
    authService.switchAdminHost(42, { handoffToken: 'handoff-from-logged-out-session' }),
    { code: 'INVALID_SWITCH_HANDOFF' }
  );
});