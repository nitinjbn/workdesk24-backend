require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { FEATURES } = require('../../src/config/features');
const { HostFeatures, sequelize } = require('../../src/models');
const repository = require('../../src/modules/superadmin/repositories/host.repository').default;
const { HostService } = require('../../src/modules/superadmin/services/host.service');

function mockHostCreation(t) {
  const transaction = {
    commit: t.mock.fn(async () => {}),
    rollback: t.mock.fn(async () => {}),
  };
  t.mock.method(sequelize, 'transaction', async () => transaction);
  t.mock.method(repository, 'getHostBySubDomain', async () => ({ data: {} }));
  t.mock.method(repository, 'createHost', async () => ({ id: 37 }));
  t.mock.method(repository, 'createAdminUser', async () => ({ id: 41 }));
  t.mock.method(repository, 'createHostSubscription', async () => ({ id: 5 }));
  t.mock.method(repository, 'createHostSettings', async () => []);
  return transaction;
}

test('host creation inserts all configured features with their defaults and parent links', async (t) => {
  const transaction = mockHostCreation(t);
  let records;
  let options;
  t.mock.method(HostFeatures, 'bulkCreate', async (rows, queryOptions) => {
    records = rows;
    options = queryOptions;
    return rows;
  });

  await new HostService().createHost({
    subDomain: 'test-host',
    features: [{ featureKey: 'TASK_MANAGEMENT', isEnabled: 1 }],
  });

  const expected = Object.values(FEATURES.DETAILS).flatMap((feature) => [
    {
      featureKey: feature.FEATURE_KEY,
      parentFeatureKey: null,
      remarks: feature.REMARKS,
      isEnabled: feature.DEFAULT_ENABLED,
    },
    ...('SUB_FEATURES' in feature
      ? Object.values(feature.SUB_FEATURES).map((child) => ({
          featureKey: child.FEATURE_KEY,
          parentFeatureKey: feature.FEATURE_KEY,
          remarks: child.REMARKS,
          isEnabled: child.DEFAULT_ENABLED,
        }))
      : []),
  ]);
  assert.equal(records.length, 10);
  assert.equal(new Set(records.map((row) => row.featureKey)).size, records.length);
  assert.deepEqual(
    records.map(({ hostId, createdAt, ...feature }) => {
      assert.equal(hostId, 37);
      assert.ok(Number.isSafeInteger(createdAt) && createdAt > 0);
      assert.equal(createdAt, records[0].createdAt);
      return feature;
    }),
    expected
  );
  assert.equal(records.find((row) => row.featureKey === 'TASK_MANAGEMENT').isEnabled, 0);
  assert.equal(options.transaction, transaction);
  assert.equal(transaction.commit.mock.callCount(), 1);
  assert.equal(transaction.rollback.mock.callCount(), 0);
});

test('host creation initializes defaults when no features are supplied', async (t) => {
  const transaction = mockHostCreation(t);
  const bulkCreate = t.mock.method(HostFeatures, 'bulkCreate', async (rows) => rows);

  await new HostService().createHost({ subDomain: 'test-host' });

  assert.equal(bulkCreate.mock.callCount(), 1);
  assert.equal(bulkCreate.mock.calls[0].arguments[0].length, 10);
  assert.equal(transaction.commit.mock.callCount(), 1);
});

test('feature insertion failure rolls back host creation', async (t) => {
  const transaction = mockHostCreation(t);
  const error = new Error('Feature insertion failed');
  t.mock.method(HostFeatures, 'bulkCreate', async () => {
    throw error;
  });

  await assert.rejects(new HostService().createHost({ subDomain: 'test-host' }), (err) => err === error);

  assert.equal(transaction.commit.mock.callCount(), 0);
  assert.equal(transaction.rollback.mock.callCount(), 1);
});
