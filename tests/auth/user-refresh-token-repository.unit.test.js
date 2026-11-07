require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../src/models');
const UserRefreshToken = models.UserRefreshToken;
const UserRefreshTokenHistory = models.UserRefreshTokenHistory;
const repository = require('../../src/modules/auth/repositories/user-refresh-token.repository').default;

test.after(async () => {
  await models.sequelize.close();
});

const transaction = { LOCK: { UPDATE: 'UPDATE' } };

test('refresh rotation archives the old hash and updates the current device row atomically', async (context) => {
  const now = Math.floor(Date.now() / 1000);
  const current = {
    id: 9,
    hostId: 3,
    userId: 17,
    tokenHash: 'old-hash',
    tokenFamily: 'family-a',
    deviceType: 'WEB',
    deviceId: 'browser-a',
    expiresAt: now + 100,
    createdAt: now - 100,
    async update(values) {
      Object.assign(this, values);
    },
  };
  let archived;
  let transactionOptions;

  context.mock.method(UserRefreshToken.sequelize, 'transaction', async (callback) =>
    callback(transaction)
  );
  context.mock.method(UserRefreshToken, 'findOne', async (options) => {
    transactionOptions = options;
    return current;
  });
  context.mock.method(UserRefreshTokenHistory, 'create', async (values) => {
    archived = values;
    return values;
  });

  const result = await repository.rotateByTokenHash(
    'old-hash',
    { userId: 17, tokenFamily: 'family-a' },
    () => ({
      data: {
        hostId: 3,
        userId: 17,
        tokenHash: 'new-hash',
        tokenFamily: 'family-a',
        deviceType: 'WEB',
        deviceId: 'browser-a',
        expiresAt: now + 200,
        createdAt: now,
        updatedAt: now,
        revokedAt: now,
        revokedReason: 'ROTATED',
      },
      value: 'new-session-tokens',
    })
  );

  assert.equal(result.status, 'ROTATED');
  assert.equal(result.value, 'new-session-tokens');
  assert.equal(archived.tokenHash, 'old-hash');
  assert.equal(archived.replacedByTokenHash, 'new-hash');
  assert.equal(current.tokenHash, 'new-hash');
  assert.equal(current.isRevoked, 0);
  assert.equal(transactionOptions.lock, transaction.LOCK.UPDATE);
  assert.equal(transactionOptions.transaction, transaction);
});

test('reusing a historical refresh hash revokes only its token family', async (context) => {
  let familyRevocation;

  context.mock.method(UserRefreshToken.sequelize, 'transaction', async (callback) =>
    callback(transaction)
  );
  context.mock.method(UserRefreshToken, 'findOne', async () => null);
  context.mock.method(UserRefreshTokenHistory, 'findOne', async () => ({
    userId: 17,
    tokenFamily: 'family-a',
  }));
  context.mock.method(UserRefreshToken, 'update', async (values, options) => {
    familyRevocation = { values, options };
    return [1];
  });

  const result = await repository.rotateByTokenHash(
    'old-hash',
    { userId: 17, tokenFamily: 'family-a' },
    () => assert.fail('A replay must not mint a replacement token')
  );

  assert.equal(result.status, 'REPLAY');
  assert.deepEqual(familyRevocation.options.where, {
    userId: 17,
    tokenFamily: 'family-a',
    isRevoked: 0,
  });
  assert.equal(familyRevocation.values.isRevoked, 1);
});

test('login replacement archives the prior device token without deleting its active row', async (context) => {
  const now = Math.floor(Date.now() / 1000);
  const current = {
    id: 11,
    hostId: 3,
    userId: 17,
    tokenHash: 'prior-hash',
    tokenFamily: 'prior-family',
    deviceType: 'WEB',
    deviceId: 'browser-a',
    expiresAt: now + 100,
    createdAt: now - 100,
    isRevoked: 0,
    async update(values) {
      Object.assign(this, values);
    },
  };
  let archived;
  let updated;

  context.mock.method(UserRefreshToken.sequelize, 'transaction', async (callback) =>
    callback(transaction)
  );
  context.mock.method(models.User, 'findByPk', async () => ({ id: 17 }));
  context.mock.method(UserRefreshToken, 'findOne', async () => current);
  context.mock.method(UserRefreshTokenHistory, 'create', async (values) => {
    archived = values;
    return values;
  });

  updated = await repository.replaceForDevice({
    hostId: 3,
    userId: 17,
    tokenHash: 'replacement-hash',
    tokenFamily: 'new-family',
    deviceType: 'WEB',
    deviceId: 'browser-a',
    expiresAt: now + 200,
    createdAt: now,
  });

  assert.equal(archived.tokenHash, 'prior-hash');
  assert.equal(archived.replacedByTokenHash, 'replacement-hash');
  assert.equal(archived.revokedReason, 'REPLACED_BY_LOGIN');
  assert.equal(updated.id, 11);
  assert.equal(updated.tokenHash, 'replacement-hash');
  assert.equal(updated.isRevoked, 0);
});