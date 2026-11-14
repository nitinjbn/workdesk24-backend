const test = require('node:test');
const assert = require('node:assert/strict');

test('MySQL task category schema, migration, uniqueness and rollback', {
  skip: !process.env.TASK_CATEGORY_MIGRATION_TEST_DB_NAME
    ? 'Requires explicit TASK_CATEGORY_MIGRATION_TEST_DB_* settings for an empty disposable test database'
    : false,
}, async () => {
  const Sequelize = require('sequelize');
  const migration = require('../../src/migrations/20261114120000-create-task-categories');
  function required(key) {
    const value = process.env[`TASK_CATEGORY_MIGRATION_TEST_DB_${key}`];
    assert.ok(value, `TASK_CATEGORY_MIGRATION_TEST_DB_${key} is required`);
    return value;
  }
  const name = required('NAME');
  assert.match(name, /(?:^|_)test(?:_|$)/i);
  const connection = new Sequelize.Sequelize(name, required('USER'), required('PASSWORD'), {
    host: required('HOST'), port: Number(required('PORT')), dialect: 'mysql',
    logging: false, pool: { min: 0, max: 3 },
    dialectOptions: { supportBigNumbers: true, bigNumberStrings: true },
  });
  const qi = connection.getQueryInterface();
  const select = (sql) => connection.query(sql, { type: Sequelize.QueryTypes.SELECT });
  let owned = false;
  try {
    assert.equal((await qi.showAllTables()).length, 0, 'Use an empty dedicated database; existing tables must never be modified');
    owned = true;
    await qi.createTable('wd_hosts', { id: { type: Sequelize.BIGINT, primaryKey: true } });
    await qi.createTable('wd_task_settings', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      hostId: { type: Sequelize.BIGINT, unique: true },
      taskNumberPrefix: Sequelize.STRING(20), nextTaskNumber: Sequelize.BIGINT,
      createdAt: Sequelize.BIGINT, updatedAt: Sequelize.BIGINT,
    });
    await qi.createTable('wd_tasks', {
      id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
      hostId: Sequelize.BIGINT, taskNumber: Sequelize.STRING(30),
      status: Sequelize.STRING(20), createdAt: Sequelize.BIGINT,
    });
    await connection.query('INSERT INTO wd_hosts (id) VALUES (1), (2)');
    await connection.query("INSERT INTO wd_task_settings (hostId, taskNumberPrefix, nextTaskNumber, createdAt) VALUES (1, 'OLD-', 41, 100)");
    await connection.query("INSERT INTO wd_tasks (hostId, taskNumber, status, createdAt) VALUES (1, 'OLD-40', 'COMPLETED', 10), (2, 'TASK-12', 'PENDING', 20)");
    await migration.up(qi, Sequelize);
    await migration.up(qi, Sequelize);
    const categories = await select('SELECT * FROM wd_task_categories ORDER BY hostId');
    assert.deepEqual(categories.map((row) => [String(row.hostId), row.taskNumberPrefix, String(row.nextTaskNumber)]), [
      ['1', 'OLD-', '41'], ['2', 'TASK-', '13'],
    ]);
    const tasks = await select('SELECT * FROM wd_tasks ORDER BY id');
    assert.deepEqual(tasks.map((row) => [row.taskNumber, row.status, String(row.createdAt)]), [
      ['OLD-40', 'COMPLETED', '10'], ['TASK-12', 'PENDING', '20'],
    ]);
    assert.deepEqual(tasks.map((row) => String(row.taskCategoryId)), categories.map((row) => String(row.id)));
    await assert.rejects(connection.query(
      "INSERT INTO wd_task_categories (hostId, name, taskNumberPrefix, createdAt) VALUES (1, 'Other', 'OLD', 100)"
    ), { name: 'SequelizeUniqueConstraintError' });
    await assert.rejects(connection.query(
      "INSERT INTO wd_task_categories (hostId, name, taskNumberPrefix, createdAt) VALUES (1, 'General', 'OTHER', 100)"
    ), { name: 'SequelizeUniqueConstraintError' });
    await assert.rejects(connection.query(
      "INSERT INTO wd_tasks (hostId, taskNumber) VALUES (1, 'OLD-40')"
    ), { name: 'SequelizeUniqueConstraintError' });
    await connection.query('UPDATE wd_task_categories SET nextTaskNumber = 50 WHERE hostId = 1');
    await migration.down(qi, Sequelize);
    assert.equal(String((await select('SELECT nextTaskNumber FROM wd_task_settings WHERE hostId = 1'))[0].nextTaskNumber), '50');
    assert.equal((await qi.describeTable('wd_tasks')).taskCategoryId, undefined);
  } finally {
    try {
      if (owned) {
        const tables = await qi.showAllTables();
        for (const table of ['wd_tasks', 'wd_task_categories', 'wd_task_settings', 'wd_hosts']) {
          if (tables.includes(table)) await qi.dropTable(table);
        }
      }
    } finally {
      await connection.close();
    }
  }
});
