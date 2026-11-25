const test = require('node:test');
const assert = require('node:assert/strict');

test('MySQL device health migration, uniqueness and rollback', {
  skip: !process.env.DEVICE_HEALTH_TEST_DB_NAME
    ? 'Requires DEVICE_HEALTH_TEST_DB_* settings for an empty disposable test database'
    : false,
}, async () => {
  const Sequelize = require('sequelize');
  const migration = require('../../src/migrations/20261125100000-create-wd-user-device-health');
  function required(key) {
    const value = process.env[`DEVICE_HEALTH_TEST_DB_${key}`];
    assert.ok(value, `DEVICE_HEALTH_TEST_DB_${key} is required`);
    return value;
  }
  const name = required('NAME');
  assert.match(name, /(?:^|_)test(?:_|$)/i);
  const db = new Sequelize.Sequelize(name, required('USER'), required('PASSWORD'), {
    dialect: 'mysql', host: required('HOST'), port: Number(required('PORT')),
    logging: false, pool: { min: 0, max: 2 },
  });
  const qi = db.getQueryInterface();
  let owned = false;
  try {
    assert.equal((await qi.showAllTables()).length, 0, 'Use an empty dedicated database');
    owned = true;
    await qi.createTable('wd_user_devices', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
    });
    await migration.up(qi, Sequelize);
    const indexes = await qi.showIndex('wd_user_device_health');
    const unique = indexes.find((index) => index.name === 'uk_device_health_host_user_device');
    assert.equal(unique.unique, true);
    assert.deepEqual(unique.fields.map((field) => field.attribute), ['hostId', 'userId', 'deviceId']);
    const insert = `INSERT INTO wd_user_device_health
      (hostId, userId, deviceId, schemaVersion, sequence, collectedAt, receivedAt, createdAt)
      VALUES (1, 2, 'device', 1, 1, 100, 101, 101)`;
    await db.query(insert);
    await assert.rejects(db.query(insert), { name: 'SequelizeUniqueConstraintError' });
    const [rows] = await db.query('SELECT locationEnabled FROM wd_user_device_health');
    assert.equal(rows[0].locationEnabled, null);
    await migration.down(qi);
    assert.deepEqual(await qi.showAllTables(), ['wd_user_devices']);
  } finally {
    try {
      if (owned) {
        const tables = await qi.showAllTables();
        for (const table of ['wd_user_device_health', 'wd_user_devices']) {
          if (tables.includes(table)) await qi.dropTable(table);
        }
      }
    } finally {
      await db.close();
    }
  }
});
