const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const Sequelize = require('sequelize');
const migration = require('../../src/migrations/20261125100000-create-wd-user-device-health');
const registry = require('../../src/models');

function harness(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  const qi = {
    async showAllTables() {
      return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    },
    async createTable(table, columns, options) {
      const definitions = Object.entries(columns).map(([name, column]) => {
        if (column.primaryKey) return `"${name}" INTEGER PRIMARY KEY`;
        return `"${name}" ${column.type.toString()} ${column.allowNull === false ? 'NOT NULL' : ''}
          ${column.defaultValue !== undefined ? `DEFAULT ${column.defaultValue}` : ''}`;
      });
      for (const [name, index] of Object.entries(options.uniqueKeys)) {
        definitions.push(`CONSTRAINT "${name}" UNIQUE (${index.fields.map((field) => `"${field}"`).join(', ')})`);
      }
      db.exec(`CREATE TABLE "${table}" (${definitions.join(', ')})`);
    },
    async dropTable(table) { db.exec(`DROP TABLE "${table}"`); },
  };
  return { db, qi };
}

test('migration creates an updatable unique snapshot with nullable observations and rolls back only its table', async (t) => {
  const { db, qi } = harness(t);
  db.exec('CREATE TABLE wd_user_devices (id INTEGER PRIMARY KEY)');
  await migration.up(qi, Sequelize);
  db.exec(`INSERT INTO wd_user_device_health
    (hostId, userId, deviceId, schemaVersion, sequence, collectedAt, receivedAt, createdAt, locationEnabled)
    VALUES (1, 2, 'device', 1, 1, 100, 101, 101, NULL)`);
  assert.equal(db.prepare('SELECT locationEnabled FROM wd_user_device_health').get().locationEnabled, null);
  assert.throws(() => db.exec(`INSERT INTO wd_user_device_health
    (hostId, userId, deviceId, schemaVersion, sequence, collectedAt, receivedAt, createdAt)
    VALUES (1, 2, 'device', 1, 2, 102, 103, 103)`), /UNIQUE constraint failed/);
  db.exec(`INSERT INTO wd_user_device_health
    (hostId, userId, deviceId, schemaVersion, sequence, collectedAt, receivedAt, createdAt)
    VALUES (3, 2, 'device', 1, 1, 100, 101, 101)`);
  db.exec("UPDATE wd_user_device_health SET sequence = 2, locationEnabled = 0 WHERE hostId = 1 AND userId = 2 AND deviceId = 'device'");
  const updated = db.prepare('SELECT sequence, locationEnabled FROM wd_user_device_health WHERE hostId = 1').get();
  assert.equal(updated.sequence, 2);
  assert.equal(updated.locationEnabled, 0);
  await assert.rejects(migration.up(qi, Sequelize), /already exists/);
  await migration.down(qi);
  assert.deepEqual(await qi.showAllTables(), ['wd_user_devices']);
});

test('registered model and migration agree on columns, nullability and MySQL types', async () => {
  let migrationColumns;
  let migrationOptions;
  await migration.up({
    async showAllTables() { return []; },
    async createTable(table, columns, options) {
      assert.equal(table, 'wd_user_device_health');
      migrationColumns = columns;
      migrationOptions = options;
    },
  }, Sequelize);
  const model = registry.UserDeviceHealth;
  assert.equal(registry.default.UserDeviceHealth, model);
  assert.equal(model.getTableName(), 'wd_user_device_health');
  assert.equal(model.options.timestamps, false);
  assert.equal(model.options.underscored, false);
  assert.deepEqual(Object.keys(model.rawAttributes).sort(), Object.keys(migrationColumns).sort());
  const sequelize = model.sequelize;
  for (const [name, column] of Object.entries(migrationColumns)) {
    const attribute = model.rawAttributes[name];
    assert.equal(attribute.type.toSql(), sequelize.normalizeDataType(column.type).toSql(), name);
    assert.equal(attribute.allowNull !== false, column.allowNull !== false, name);
  }
  const unique = model.options.indexes.find((index) => index.unique);
  assert.deepEqual(unique.fields, migrationOptions.uniqueKeys[unique.name].fields);
  assert.equal(model.associations.host.target, registry.Host);
  assert.equal(model.associations.user.target, registry.User);
});

test('migration generates the unique key in the MySQL CREATE TABLE statement', async () => {
  const sequelize = new Sequelize.Sequelize('unused', 'unused', 'unused', { dialect: 'mysql', logging: false });
  const qi = sequelize.getQueryInterface();
  let sql;
  sequelize.query = async (statement) => { sql = statement; };
  await migration.up({
    showAllTables: async () => [],
    createTable: qi.createTable.bind(qi),
  }, Sequelize);
  assert.match(sql, /UNIQUE `uk_device_health_host_user_device` \(`hostId`, `userId`, `deviceId`\)/);
  assert.match(sql, /`locationEnabled` TINYINT\(1\)(?:,|\s)/);
  await sequelize.close();
});
