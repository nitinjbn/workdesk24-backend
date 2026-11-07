const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../../src/migrations/20261030105000-create-switch-host-context-prerequisites');

const types = {
  BIGINT: 'BIGINT',
  STRING: (length) => `STRING(${length})`,
  TEXT: 'TEXT',
  TINYINT: 'TINYINT',
  SMALLINT: 'SMALLINT',
  INTEGER: 'INTEGER',
  DECIMAL: (precision, scale) => `DECIMAL(${precision},${scale})`,
  ENUM: (...values) => `ENUM(${values.join(',')})`,
  DATEONLY: 'DATEONLY',
};

test('fresh install creates host settings, subscription cycles, then host subscriptions', async () => {
  const tables = ['wd_hosts'];
  const created = [];
  const indexes = [];
  const queryInterface = {
    async showAllTables() { return [...tables]; },
    async createTable(name, columns) {
      tables.push(name);
      created.push({ name, columns });
    },
    async addIndex(table, fields, options) { indexes.push({ table, fields, options }); },
  };

  await migration.up(queryInterface, types);

  assert.deepEqual(created.map((table) => table.name), [
    'wd_host_settings',
    'wd_subscription_cycles',
    'wd_host_subscriptions',
  ]);
  const subscriptions = created[2];
  assert.deepEqual(subscriptions.columns.hostId.references, { model: 'wd_hosts', key: 'id' });
  assert.deepEqual(subscriptions.columns.subscriptionCycleId.references, {
    model: 'wd_subscription_cycles',
    key: 'id',
  });
  assert.equal(subscriptions.columns.planStartDate.type, 'DATEONLY');
  assert.equal(subscriptions.columns.paymentStatus.type, 'ENUM(FREE,PENDING,PAID)');
  assert.equal(indexes.some((index) => index.table === 'wd_host_subscriptions' && index.fields[0] === 'hostId'), true);
  assert.equal(indexes.some((index) => index.table === 'wd_host_subscriptions' && index.fields[0] === 'licensedUserCount'), true);
});

test('existing production host-context tables are left unchanged', async () => {
  let created = false;
  const queryInterface = {
    async showAllTables() {
      return ['wd_hosts', 'wd_host_settings', 'wd_subscription_cycles', 'wd_host_subscriptions'];
    },
    async createTable() { created = true; },
    async addIndex() { created = true; },
  };

  await migration.up(queryInterface, types);

  assert.equal(created, false);
});

test('prerequisite rollback is intentionally non-destructive', async () => {
  let dropped = false;
  await migration.down({ async dropTable() { dropped = true; } });
  assert.equal(dropped, false);
});