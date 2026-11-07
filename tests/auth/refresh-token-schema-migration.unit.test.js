const test = require('node:test');
const assert = require('node:assert/strict');
const migration = require('../../src/migrations/20261030110000-ensure-user-refresh-token-table');
const historyMigration = require('../../src/migrations/20261030120000-create-user-refresh-token-history');

const sequelizeTypes = {
  BIGINT: 'BIGINT',
  STRING: (length) => `STRING(${length})`,
  ENUM: (...values) => `ENUM(${values.join(',')})`,
  TINYINT: 'TINYINT',
};

test('refresh schema migration is a no-op when the verified table exists', async () => {
  let created = false;
  const queryInterface = {
    showAllTables: async () => ['wd_user_refresh_tokens'],
    createTable: async () => { created = true; },
  };

  await migration.up(queryInterface, sequelizeTypes);

  assert.equal(created, false);
});

test('refresh schema migration creates the current table when the legacy table is empty', async () => {
  let createdTable;
  let droppedTable = false;
  let ownershipRecord;
  const queryInterface = {
    showAllTables: async () => ['wd_admin_refresh_tokens'],
    sequelize: { query: async () => [[{ rowCount: 0 }]] },
    createTable: async (tableName, columns) => { createdTable = { tableName, columns }; },
    addIndex: async () => undefined,
    bulkInsert: async (tableName, rows) => {
      if (tableName === 'wd_migration_object_ownership') ownershipRecord = rows[0];
    },
    dropTable: async () => { droppedTable = true; },
  };

  await migration.up(queryInterface, sequelizeTypes);

  assert.equal(createdTable.tableName, 'wd_user_refresh_tokens');
  assert.equal(createdTable.columns.hostId.allowNull, false);
  assert.equal(ownershipRecord.objectName, 'wd_user_refresh_tokens');
  assert.equal(droppedTable, false);
});

test('refresh schema migration refuses to hide populated legacy token rows', async () => {
  let created = false;
  const queryInterface = {
    showAllTables: async () => ['wd_admin_refresh_tokens'],
    sequelize: { query: async () => [[{ rowCount: 2 }]] },
    createTable: async () => { created = true; },
  };

  await assert.rejects(
    migration.up(queryInterface, sequelizeTypes),
    /reviewed conversion/
  );
  assert.equal(created, false);
});

test('refresh schema rollback never drops a pre-existing unowned table', async () => {
  let droppedTable = false;
  const queryInterface = {
    showAllTables: async () => ['wd_user_refresh_tokens', 'wd_migration_object_ownership'],
    sequelize: { query: async () => [[]] },
    dropTable: async () => { droppedTable = true; },
  };

  await migration.down(queryInterface);

  assert.equal(droppedTable, false);
});

test('refresh schema rollback refuses to drop a table created by the migration when populated', async () => {
  let droppedTable = false;
  let queryCount = 0;
  const queryInterface = {
    showAllTables: async () => ['wd_user_refresh_tokens', 'wd_migration_object_ownership'],
    sequelize: { query: async () => {
      queryCount += 1;
      return queryCount === 1 ? [[{ id: 1 }]] : [[{ rowCount: 3 }]];
    } },
    dropTable: async () => { droppedTable = true; },
  };

  await assert.rejects(migration.down(queryInterface), /Refusing to drop a populated/);
  assert.equal(droppedTable, false);
});

test('refresh schema rollback drops only an empty table with its ownership marker', async () => {
  let droppedTable = false;
  let ownershipDeleted = false;
  let queryCount = 0;
  const queryInterface = {
    showAllTables: async () => ['wd_user_refresh_tokens', 'wd_migration_object_ownership'],
    sequelize: { query: async () => {
      queryCount += 1;
      return queryCount === 1 ? [[{ id: 8 }]] : [[{ rowCount: 0 }]];
    } },
    dropTable: async (tableName) => {
      assert.equal(tableName, 'wd_user_refresh_tokens');
      droppedTable = true;
    },
    bulkDelete: async (tableName, where) => {
      ownershipDeleted = tableName === 'wd_migration_object_ownership' &&
        where.objectName === 'wd_user_refresh_tokens';
    },
  };

  await migration.down(queryInterface);

  assert.equal(droppedTable, true);
  assert.equal(ownershipDeleted, true);
});

test('refresh schema migration tolerates an already-present history index', async () => {
  const indexes = new Set([
    'uk_refresh_history_token_hash',
    'idx_refresh_history_token_id',
    'idx_refresh_history_user_family',
    'idx_refresh_history_switch_session',
  ]);
  const queryInterface = {
    showAllTables: async () => ['wd_user_refresh_token_history'],
    showIndex: async () => [...indexes].map((name) => ({ name })),
    addIndex: async (_table, _fields, options) => {
      if (indexes.has(options.name)) throw new Error(`duplicate index ${options.name}`);
      indexes.add(options.name);
    },
    createTable: async () => assert.fail('existing history table should not be recreated'),
  };

  await historyMigration.up(queryInterface, {
    BIGINT: 'BIGINT',
    STRING: () => 'STRING',
    ENUM: () => 'ENUM',
    TINYINT: 'TINYINT',
    INTEGER: 'INTEGER',
  });

  assert.equal(indexes.size, 4);
});