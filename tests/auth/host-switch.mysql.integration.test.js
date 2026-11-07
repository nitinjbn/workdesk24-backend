require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const crypto = require('node:crypto');
const jwt = require('jsonwebtoken');

const enabled = process.env.WD24_MYSQL_TEST_DISPOSABLE === '1';
const requiredVariables = [
  'WD24_MYSQL_TEST_DATABASE',
  'WD24_MYSQL_TEST_PORT',
  'WD24_MYSQL_TEST_USER',
  'WD24_MYSQL_TEST_PASSWORD',
];

let models;
let authService;
let userRefreshTokenRepository;
let adminSwitchSessionRepository;
let host;
let adminUser;
let hostB;

if (enabled) {
  const missing = requiredVariables.filter((name) => !process.env[name]);
  if (missing.length) {
    throw new Error(`Disposable MySQL integration is enabled but missing: ${missing.join(', ')}`);
  }
  if (process.env.WD24_MYSQL_TEST_HOST !== '127.0.0.1') {
    throw new Error('Disposable MySQL tests are restricted to DB_HOST=127.0.0.1');
  }
  if (!/^wd24_hardening_test_[a-z0-9_]+$/i.test(process.env.WD24_MYSQL_TEST_DATABASE)) {
    throw new Error('Refusing MySQL integration test database outside wd24_hardening_test_*');
  }

  process.env.NODE_ENV = 'test';
  process.env.DB_HOST = process.env.WD24_MYSQL_TEST_HOST;
  process.env.DB_PORT = process.env.WD24_MYSQL_TEST_PORT;
  process.env.DB_NAME_TEST = process.env.WD24_MYSQL_TEST_DATABASE;
  process.env.DB_USER = process.env.WD24_MYSQL_TEST_USER;
  process.env.DB_PASSWORD = process.env.WD24_MYSQL_TEST_PASSWORD;
  process.env.JWT_SECRET = 'wd24-disposable-integration-access-secret';
  process.env.JWT_REFRESH_SECRET = 'wd24-disposable-integration-refresh-secret';

  models = require('../../src/models');
  authService = require('../../src/modules/auth/services/auth.service').default;
  userRefreshTokenRepository = require('../../src/modules/auth/repositories/user-refresh-token.repository').default;
  adminSwitchSessionRepository = require('../../src/modules/auth/repositories/admin-switch-session.repository').default;
}

test.before(async () => {
  if (!enabled) return;

  await models.sequelize.authenticate();
  const [identityRows] = await models.sequelize.query(
    'SELECT VERSION() AS version, @@hostname AS host, @@port AS port, @@datadir AS dataDir, @@global.tx_isolation AS isolationLevel, DATABASE() AS databaseName, CURRENT_USER() AS currentUser, @@default_storage_engine AS storageEngine'
  );
  const identity = identityRows[0];
  assert.equal(identity.version, '5.7.43');
  assert.equal(Number(identity.port), Number(process.env.WD24_MYSQL_TEST_PORT));
  assert.ok(identity.dataDir.includes('wd24-mysql57-hardening-'));
  assert.equal(identity.databaseName, process.env.WD24_MYSQL_TEST_DATABASE);
  assert.equal(identity.currentUser, `${process.env.WD24_MYSQL_TEST_USER}@127.0.0.1`);
  assert.equal(identity.storageEngine, 'InnoDB');

  [adminUser] = await models.User.findAll({ where: { isDeleted: 0 }, limit: 1 });
  assert.ok(adminUser, 'fresh test schema must contain a seed user');
  await adminUser.update({
    isSuperAdmin: 1,
    isAdminUser: 1,
    isFieldAppUser: 1,
    accountStatus: 'ACTIVE',
  });

  const suffix = crypto.randomUUID().replace(/-/g, '').slice(0, 12);
  host = await models.Host.findByPk(Number(adminUser.hostId));
  assert.ok(host, 'seed host must exist');
  const now = Math.floor(Date.now() / 1000);
  const hostEmail = `sw-${suffix}@example.test`;
  await models.sequelize.query(
    'INSERT INTO wd_hosts (subDomain,email,companyName,password,isActive,isDeleted,createdAt,updatedAt) VALUES (:subDomain,:email,:companyName,:password,1,0,:now,:now)',
    {
      replacements: {
        subDomain: `sw${suffix}`,
        email: hostEmail,
        companyName: `Switch Test ${suffix}`,
        password: crypto.randomBytes(32).toString('hex'),
        now,
      },
    }
  );
  const [createdHosts] = await models.sequelize.query(
    'SELECT id FROM wd_hosts WHERE email = :email',
    { replacements: { email: hostEmail } }
  );
  hostB = await models.Host.findByPk(Number(createdHosts[0]?.id));
  assert.ok(hostB, 'second host fixture must exist');
});

test.after(async () => {
  if (models?.sequelize) await models.sequelize.close();
});

function uniqueValue(prefix) {
  return `${prefix}-${crypto.randomUUID()}`;
}

function hashToken(token) {
  return crypto.createHash('sha256').update(token).digest('hex');
}

function signRefreshToken(payload) {
  return jwt.sign(payload, process.env.JWT_REFRESH_SECRET, { expiresIn: '2h' });
}

async function createRefreshRecord({
  token,
  tokenFamily,
  deviceId,
  switchSessionId = null,
  contextVersion = null,
}) {
  const now = Math.floor(Date.now() / 1000);
  const decoded = jwt.decode(token);
  return models.UserRefreshToken.create({
    hostId: Number(adminUser.hostId),
    userId: Number(adminUser.id),
    tokenHash: hashToken(token),
    tokenFamily,
    deviceType: 'WEB',
    deviceId,
    expiresAt: decoded.exp,
    createdAt: now,
    updatedAt: now,
    isRevoked: 0,
    ...(switchSessionId ? { switchSessionId, contextVersion } : {}),
  });
}

async function createSwitchFixture() {
  const now = Math.floor(Date.now() / 1000);
  const sourceTokenFamily = uniqueValue('source');
  const sourceDeviceId = uniqueValue('source-device');
  const sourceRefreshToken = signRefreshToken({
    hostId: Number(adminUser.hostId),
    userId: Number(adminUser.id),
    tokenFamily: sourceTokenFamily,
    tokenType: 'refresh',
  });
  await createRefreshRecord({
    token: sourceRefreshToken,
    tokenFamily: sourceTokenFamily,
    deviceId: sourceDeviceId,
  });

  const switchSessionId = crypto.randomUUID();
  const tokenFamily = uniqueValue('switch');
  const deviceId = uniqueValue('support-device');
  const contextVersion = 1;
  const switchRefreshToken = signRefreshToken({
    hostId: Number(adminUser.hostId),
    userId: Number(adminUser.id),
    tokenFamily,
    tokenType: 'refresh',
    switchSessionId,
    contextVersion,
  });
  const refreshRecord = await createRefreshRecord({
    token: switchRefreshToken,
    tokenFamily,
    deviceId,
    switchSessionId,
    contextVersion,
  });
  const session = await models.AdminSwitchSession.create({
    switchSessionId,
    userId: Number(adminUser.id),
    originalHostId: Number(adminUser.hostId),
    sourceTokenFamily,
    currentHostId: Number(adminUser.hostId),
    tokenFamily,
    deviceId,
    currentRefreshTokenId: Number(refreshRecord.id),
    contextVersion,
    isActive: 1,
    startedAt: now,
    createdAt: now,
    updatedAt: now,
    isDeleted: 0,
  });

  return { session, sourceRefreshToken, sourceTokenFamily, switchRefreshToken, tokenFamily };
}

async function countActiveFamily(userId, tokenFamily) {
  return models.UserRefreshToken.count({ where: { userId, tokenFamily, isRevoked: 0 } });
}

const testOptions = enabled ? {} : { skip: 'Set WD24_MYSQL_TEST_DISPOSABLE=1 and explicit loopback test DB variables' };

test('InnoDB concurrent same-token refresh allows one rotation then revokes that family on replay', testOptions, async () => {
  const tokenFamily = uniqueValue('rotation');
  const deviceId = uniqueValue('rotation-device');
  const refreshToken = signRefreshToken({
    hostId: Number(adminUser.hostId),
    userId: Number(adminUser.id),
    tokenFamily,
    tokenType: 'refresh',
  });
  await createRefreshRecord({ token: refreshToken, tokenFamily, deviceId });

  const rotate = () => userRefreshTokenRepository.rotateByTokenHash(
    hashToken(refreshToken),
    { userId: Number(adminUser.id), tokenFamily },
    (current) => {
      const now = Math.floor(Date.now() / 1000);
      const replacementHash = uniqueValue('replacement');
      return {
        data: {
          hostId: Number(current.hostId),
          userId: Number(current.userId),
          tokenHash: replacementHash,
          tokenFamily,
          deviceType: 'WEB',
          deviceId,
          expiresAt: now + 3600,
          createdAt: now,
          updatedAt: now,
          revokedAt: now,
          revokedReason: 'ROTATED',
        },
        value: replacementHash,
      };
    }
  );

  const results = await Promise.all([rotate(), rotate()]);
  assert.deepEqual(results.map((result) => result.status).sort(), ['REPLAY', 'ROTATED']);
  assert.equal(await countActiveFamily(Number(adminUser.id), tokenFamily), 0);
  assert.equal(await models.UserRefreshTokenHistory.count({ where: { tokenHash: hashToken(refreshToken) } }), 1);
});

test('two simultaneous host switches serialize on the switch-session row and cannot mint two current tokens', testOptions, async () => {
  const fixture = await createSwitchFixture();
  const context = {
    userId: Number(adminUser.id),
    switchSessionId: fixture.session.switchSessionId,
    contextVersion: 1,
  };

  const results = await Promise.allSettled([
    authService.switchAdminHost(Number(hostB.id), context),
    authService.switchAdminHost(Number(hostB.id), context),
  ]);
  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const session = await adminSwitchSessionRepository.findBySwitchSessionId(fixture.session.switchSessionId);
  assert.equal(Number(session.currentHostId), Number(hostB.id));
  assert.equal(Number(session.contextVersion), 2);
  const active = await models.UserRefreshToken.findAll({
    where: { switchSessionId: fixture.session.switchSessionId, isRevoked: 0 },
  });
  assert.equal(active.length, 1);
  assert.equal(Number(active[0].contextVersion), 2);
});

test('switch refresh racing with host change leaves one token at the committed context version', testOptions, async () => {
  const fixture = await createSwitchFixture();
  const results = await Promise.allSettled([
    authService.refreshAdminSession(fixture.switchRefreshToken),
    authService.switchAdminHost(Number(hostB.id), {
      userId: Number(adminUser.id),
      switchSessionId: fixture.session.switchSessionId,
      contextVersion: 1,
    }),
  ]);

  assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
  assert.equal(results.filter((result) => result.status === 'rejected').length, 1);
  const session = await adminSwitchSessionRepository.findBySwitchSessionId(fixture.session.switchSessionId);
  const active = await models.UserRefreshToken.findAll({
    where: { switchSessionId: fixture.session.switchSessionId, isRevoked: 0 },
  });
  assert.equal(active.length, 1);
  assert.equal(Number(active[0].contextVersion), Number(session.contextVersion));
  assert.equal(Number(active[0].hostId), Number(session.originalHostId));
});

test('refresh racing with Super Admin logout leaves source and derived sessions revoked', testOptions, async () => {
  const fixture = await createSwitchFixture();
  const results = await Promise.allSettled([
    authService.refreshSuperAdminSession(fixture.sourceRefreshToken),
    authService.logoutSuperAdminSession(fixture.sourceRefreshToken),
  ]);

  assert.equal(results[1].status, 'fulfilled');
  assert.equal(await countActiveFamily(Number(adminUser.id), fixture.sourceTokenFamily), 0);
  assert.equal(await countActiveFamily(Number(adminUser.id), fixture.tokenFamily), 0);
  const session = await models.AdminSwitchSession.findByPk(fixture.session.id);
  assert.equal(Number(session.isActive), 0);
});

test('host switching racing with source logout cannot leave a valid derived session', testOptions, async () => {
  const fixture = await createSwitchFixture();
  const results = await Promise.allSettled([
    authService.switchAdminHost(Number(hostB.id), {
      userId: Number(adminUser.id),
      switchSessionId: fixture.session.switchSessionId,
      contextVersion: 1,
    }),
    authService.logoutSuperAdminSession(fixture.sourceRefreshToken),
  ]);
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(await countActiveFamily(Number(adminUser.id), fixture.sourceTokenFamily), 0);
  assert.equal(await countActiveFamily(Number(adminUser.id), fixture.tokenFamily), 0);
  const session = await models.AdminSwitchSession.findByPk(fixture.session.id);
  assert.equal(Number(session.isActive), 0);
});

test('source logout racing with switch refresh invalidates all derived credentials', testOptions, async () => {
  const fixture = await createSwitchFixture();
  const results = await Promise.allSettled([
    authService.refreshAdminSession(fixture.switchRefreshToken),
    authService.logoutSuperAdminSession(fixture.sourceRefreshToken),
  ]);
  assert.equal(results[1].status, 'fulfilled');
  assert.equal(await countActiveFamily(Number(adminUser.id), fixture.sourceTokenFamily), 0);
  assert.equal(await countActiveFamily(Number(adminUser.id), fixture.tokenFamily), 0);
  const session = await models.AdminSwitchSession.findByPk(fixture.session.id);
  assert.equal(Number(session.isActive), 0);
});

test('revoking one source family leaves another device family active', testOptions, async () => {
  const firstFamily = uniqueValue('source-one');
  const secondFamily = uniqueValue('source-two');
  await createRefreshRecord({
    token: signRefreshToken({ hostId: Number(adminUser.hostId), userId: Number(adminUser.id), tokenFamily: firstFamily, tokenType: 'refresh' }),
    tokenFamily: firstFamily,
    deviceId: uniqueValue('device-one'),
  });
  await createRefreshRecord({
    token: signRefreshToken({ hostId: Number(adminUser.hostId), userId: Number(adminUser.id), tokenFamily: secondFamily, tokenType: 'refresh' }),
    tokenFamily: secondFamily,
    deviceId: uniqueValue('device-two'),
  });

  await userRefreshTokenRepository.revokeActiveForFamily(Number(adminUser.id), firstFamily);

  assert.equal(await countActiveFamily(Number(adminUser.id), firstFamily), 0);
  assert.equal(await countActiveFamily(Number(adminUser.id), secondFamily), 1);
});

test('Admin, Super Admin and App login/refresh/logout remain compatible on MySQL', testOptions, async () => {
  const adminDevice = uniqueValue('admin-login-device');
  const adminLogin = await authService.adminLogin({
    email: adminUser.email,
    password: 'admin123',
    deviceDetails: { deviceId: adminDevice },
  });
  assert.ok(adminLogin.accessToken);
  assert.ok(adminLogin.refreshToken);
  const adminRefresh = await authService.refreshAdminSession(adminLogin.refreshToken);
  assert.ok(adminRefresh.accessToken);
  assert.notEqual(adminRefresh.refreshToken, adminLogin.refreshToken);
  await authService.logoutAdminSession(adminRefresh.refreshToken);
  assert.equal(await countActiveFamily(Number(adminUser.id), jwt.decode(adminRefresh.refreshToken).tokenFamily), 0);

  const superAdminDevice = uniqueValue('super-admin-login-device');
  const superAdminLogin = await authService.superAdminLogin({
    email: adminUser.email,
    password: 'admin123',
    deviceDetails: { deviceId: superAdminDevice },
  });
  assert.ok(superAdminLogin.accessToken);
  const superAdminRefresh = await authService.refreshSuperAdminSession(superAdminLogin.refreshToken);
  assert.ok(superAdminRefresh.accessToken);
  assert.notEqual(superAdminRefresh.refreshToken, superAdminLogin.refreshToken);
  await authService.logoutSuperAdminSession(superAdminRefresh.refreshToken);
  assert.equal(await countActiveFamily(Number(adminUser.id), jwt.decode(superAdminRefresh.refreshToken).tokenFamily), 0);

  const appDevice = uniqueValue('app-login-device');
  const appLogin = await authService.login({
    email: adminUser.email,
    password: 'admin123',
    deviceDetails: { deviceId: appDevice },
  });
  assert.ok(appLogin.accessToken);
  assert.ok(appLogin.refreshToken);
  const appRefresh = await authService.refreshAppSession(appLogin.refreshToken);
  assert.ok(appRefresh.accessToken);
  assert.notEqual(appRefresh.refreshToken, appLogin.refreshToken);
});