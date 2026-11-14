const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const Sequelize = require('sequelize');
const migration = require('../../src/migrations/20261114120000-create-task-categories');

// Execute migration DML locally; translate only MySQL-specific DDL/upsert syntax.
// The opt-in MySQL suite remains required for deployment validation.
function harness(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.function('CHAR_LENGTH', { deterministic: true }, (value) => Array.from(value).length);
  db.function('CONCAT', { deterministic: true }, (left, right) => left + right);
  db.function('regexp', (pattern, value) => new RegExp(pattern).test(value) ? 1 : 0);
  db.exec(`
    CREATE TABLE wd_hosts (id INTEGER PRIMARY KEY);
    INSERT INTO wd_hosts VALUES (1), (2), (3), (4);
    CREATE TABLE wd_task_settings (
      id INTEGER PRIMARY KEY, hostId INTEGER UNIQUE, taskNumberPrefix TEXT,
      nextTaskNumber INTEGER, createdAt INTEGER, updatedAt INTEGER
    );
    CREATE TABLE wd_tasks (
      id INTEGER PRIMARY KEY, hostId INTEGER, taskNumber TEXT, title TEXT,
      status TEXT, createdAt INTEGER, assignedToUserId INTEGER, createdByUserId INTEGER,
      customerId INTEGER, visitId INTEGER, isDeleted INTEGER
    );
    INSERT INTO wd_task_settings VALUES (1, 1, 'OLD-', 41, 100, 101), (2, 3, 'TASK', 2, 200, 201), (3, 4, 'SPEC-', 1, 300, 301);
    INSERT INTO wd_tasks VALUES
      (1, 1, 'OLD-12', 'Legacy', 'COMPLETED', 10, 11, 12, 13, 14, 0),
      (2, 2, 'TASK-12', 'No settings', 'IN_PROGRESS', 20, 21, 22, NULL, NULL, 0),
      (3, 3, 'TASK-99', 'Deleted', 'CANCELLED', 30, 31, 32, NULL, NULL, 1),
      (4, 3, NULL, 'Unnumbered', 'PENDING', 40, 31, 32, NULL, NULL, 0);
  `);
  const sqlLog = [];
  const qi = {
    sequelize: {
      async query(sql, options = {}) {
        sqlLog.push(sql);
        let translated = sql
          .replace(/RIGHT\(taskNumberPrefix, 1\)/g, 'SUBSTR(taskNumberPrefix, -1)')
          .replace(/LEFT\(taskNumber, CHAR_LENGTH\(:prefix\)\)/g, 'SUBSTR(taskNumber, 1, CHAR_LENGTH(:prefix))');
        if (sql.includes('ON DUPLICATE KEY UPDATE')) {
          translated = translated.split('ON DUPLICATE KEY UPDATE')[0];
          translated += sql.includes('INSERT INTO wd_task_settings')
            ? `ON CONFLICT(hostId) DO UPDATE SET taskNumberPrefix = excluded.taskNumberPrefix,
               nextTaskNumber = MAX(wd_task_settings.nextTaskNumber, excluded.nextTaskNumber), updatedAt = excluded.updatedAt`
            : 'ON CONFLICT(hostId, activeName) DO UPDATE SET nextTaskNumber = MAX(nextTaskNumber, excluded.nextTaskNumber)';
        }
        const statement = db.prepare(translated);
        const bindings = options.replacements ? [options.replacements] : [];
        return /^\s*SELECT/i.test(sql) ? statement.all(...bindings).map((row) => ({ ...row })) : statement.run(...bindings);
      },
      async transaction(operation) {
        db.exec('BEGIN');
        try {
          const result = await operation({});
          db.exec('COMMIT');
          return result;
        } catch (error) {
          db.exec('ROLLBACK');
          throw error;
        }
      },
    },
    async showAllTables() {
      return db.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all().map((row) => row.name);
    },
    async describeTable(table) {
      return Object.fromEntries(db.prepare(`PRAGMA table_xinfo(${table})`).all().map((column) => [column.name, column]));
    },
    async createTable(table, columns) {
      const definitions = Object.entries(columns).map(([name, column]) => {
        if (column.primaryKey) return `${name} INTEGER PRIMARY KEY`;
        return `${name} ${column.type.toString()} ${column.allowNull === false ? 'NOT NULL' : ''}
          ${column.defaultValue != null ? `DEFAULT ${column.defaultValue}` : ''}`;
      });
      db.exec(`CREATE TABLE ${table} (${definitions.join(',')})`);
    },
    async addColumn(table, column) { db.exec(`ALTER TABLE ${table} ADD COLUMN ${column} INTEGER`); },
    async showIndex(table) { return db.prepare(`PRAGMA index_list(${table})`).all().map((row) => ({ name: row.name })); },
    async addIndex(table, fields, options) {
      db.exec(`CREATE ${options.unique ? 'UNIQUE' : ''} INDEX ${options.name} ON ${table} (${fields.join(',')})`);
    },
    async removeColumn(table, column) {
      db.exec('DROP INDEX IF EXISTS idx_tasks_category');
      db.exec(`ALTER TABLE ${table} DROP COLUMN ${column}`);
    },
    async dropTable(table) { db.exec(`DROP TABLE ${table}`); },
  };
  return { db, qi, sqlLog };
}

test('migration preserves existing task data, migrates settings and safely derives missing/stale counters per host', async (t) => {
  const h = harness(t);
  const before = h.db.prepare('SELECT * FROM wd_tasks ORDER BY id').all();
  await migration.up(h.qi, Sequelize);
  const categories = h.db.prepare('SELECT * FROM wd_task_categories ORDER BY hostId').all();
  assert.deepEqual(categories.map((row) => [row.hostId, row.name, row.taskNumberPrefix, row.nextTaskNumber]), [
    [1, 'General', 'OLD-', 41], [2, 'General', 'TASK-', 13],
    [3, 'General', 'TASK', 100], [4, 'General', 'SPEC-', 1],
  ]);
  assert.equal(categories[0].createdAt, 100);
  const after = h.db.prepare('SELECT * FROM wd_tasks ORDER BY id').all();
  for (let index = 0; index < after.length; index++) {
    const { taskCategoryId, ...unchanged } = after[index];
    assert.deepEqual(unchanged, { ...before[index] });
    assert.equal(categories.find((row) => row.id === taskCategoryId).hostId, unchanged.hostId);
  }
  await migration.up(h.qi, Sequelize);
  assert.equal(h.db.prepare('SELECT COUNT(*) count FROM wd_task_categories').get().count, 4);
  assert.deepEqual(h.db.prepare('SELECT * FROM wd_tasks ORDER BY id').all(), after);
});

test('migration rejects pre-existing duplicate numbers and orphan host ownership before schema changes', async (t) => {
  for (const kind of ['duplicate', 'orphan']) {
    await t.test(kind, async (t) => {
      const h = harness(t);
      if (kind === 'duplicate') h.db.exec("UPDATE wd_tasks SET hostId = 1, taskNumber = 'OLD-12' WHERE id = 2");
      else h.db.exec('UPDATE wd_tasks SET hostId = 999 WHERE id = 2');
      await assert.rejects(migration.up(h.qi, Sequelize), /Duplicate|Orphan/);
      assert.equal((await h.qi.showAllTables()).includes('wd_task_categories'), false);
    });
  }
});

test('backfill failure rolls all data writes back, keeps restartable DDL and does not change task numbers', async (t) => {
  const h = harness(t);
  h.db.exec('UPDATE wd_task_settings SET nextTaskNumber = 0 WHERE hostId = 3');
  await assert.rejects(migration.up(h.qi, Sequelize), /counter/);
  assert.equal(h.db.prepare('SELECT COUNT(*) count FROM wd_task_categories').get().count, 0);
  assert.equal(h.db.prepare('SELECT COUNT(*) count FROM wd_tasks WHERE taskCategoryId IS NOT NULL').get().count, 0);
  h.db.exec('UPDATE wd_task_settings SET nextTaskNumber = 2 WHERE hostId = 3');
  await migration.up(h.qi, Sequelize);
  assert.equal(h.db.prepare('SELECT COUNT(*) count FROM wd_task_categories').get().count, 4);
});

test('rollback preserves the General sequence in legacy settings and refuses used custom categories', async (t) => {
  const h = harness(t);
  await migration.up(h.qi, Sequelize);
  h.db.exec('UPDATE wd_task_categories SET nextTaskNumber = 50 WHERE hostId = 1');
  await migration.down(h.qi, Sequelize);
  assert.equal(h.db.prepare('SELECT nextTaskNumber FROM wd_task_settings WHERE hostId = 1').get().nextTaskNumber, 50);
  assert.equal(h.db.prepare('SELECT nextTaskNumber FROM wd_task_settings WHERE hostId = 2').get().nextTaskNumber, 13);
  assert.equal((await h.qi.showAllTables()).includes('wd_task_categories'), false);
  await migration.up(h.qi, Sequelize);
  h.db.exec(`
    INSERT INTO wd_task_categories (hostId, name, taskNumberPrefix, nextTaskNumber, isEnabled, isDeleted, createdAt)
      VALUES (1, 'Custom', 'CUSTOM', 1, 1, 0, 100);
    UPDATE wd_tasks SET taskCategoryId = (SELECT id FROM wd_task_categories WHERE name = 'Custom') WHERE id = 1;
  `);
  await assert.rejects(migration.down(h.qi, Sequelize), /Cannot roll back/);
  assert.equal((await h.qi.describeTable('wd_tasks')).taskCategoryId.name, 'taskCategoryId');
});
