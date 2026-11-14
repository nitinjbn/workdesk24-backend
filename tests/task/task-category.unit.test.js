require('ts-node/register/transpile-only');
process.env.JWT_SECRET = 'task-category-test-signing-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { UniqueConstraintError, ValidationErrorItem } = require('sequelize');
const { TaskCategoryService } = require('../../src/modules/task/services/task-category.service');
const categoryService = require('../../src/modules/task/services/task-category.service').default;
const { TaskCategoryController } = require('../../src/modules/task/controllers/task-category.controller');
const { TaskService } = require('../../src/modules/task/services/task.service');
const { TaskRepository } = require('../../src/modules/task/repositories/task.repository');
const { TaskCategoryRepository } = require('../../src/modules/task/repositories/task-category.repository');
const { Task, TaskCategory, Host } = require('../../src/models');

const admin = { hostId: 7, isAdmin: true };

function stubCategoryQueries(t, database) {
  return t.mock.method(TaskCategory.sequelize, 'query', async (sql, options) => {
    const rows = database.prepare(sql).all().map((entry) => ({ ...entry }));
    return options.plain ? rows[0] : rows.map((entry) => {
      const model = TaskCategory.build(entry);
      if (entry.taskCount !== undefined) model.setDataValue('taskCount', entry.taskCount);
      return model;
    });
  });
}

function harness(t) {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  database.exec(`
    CREATE TABLE wd_task_categories (
      id INTEGER PRIMARY KEY, hostId INTEGER, name TEXT, description TEXT, taskNumberPrefix TEXT,
      nextTaskNumber INTEGER DEFAULT 1, isEnabled INTEGER DEFAULT 1, isDeleted INTEGER DEFAULT 0,
      createdAt INTEGER, updatedAt INTEGER, deletedAt INTEGER,
      activeName TEXT GENERATED ALWAYS AS (CASE WHEN isDeleted = 0 THEN name ELSE NULL END) STORED,
      activePrefix TEXT GENERATED ALWAYS AS (CASE WHEN isDeleted = 0 THEN
        CASE WHEN substr(taskNumberPrefix, -1) = '-' THEN taskNumberPrefix ELSE taskNumberPrefix || '-' END ELSE NULL END) STORED,
      UNIQUE(hostId, activeName COLLATE NOCASE), UNIQUE(hostId, activePrefix COLLATE NOCASE)
    );
    CREATE TABLE wd_tasks (id INTEGER PRIMARY KEY, hostId INTEGER, taskCategoryId INTEGER, isDeleted INTEGER, taskNumber TEXT);
  `);
  const transactions = [];
  function write(operation) {
    try { return operation(); } catch (error) {
      if (!/UNIQUE constraint failed/.test(error.message)) throw error;
      const path = error.message.includes('activeName') ? 'activeName' : 'activePrefix';
      throw new UniqueConstraintError({ errors: [new ValidationErrorItem('Duplicate', 'unique violation', path)] });
    }
  }
  const row = (value) => value ? { ...value } : null;
  const repository = {
    async create(data) {
      return write(() => {
        const keys = Object.keys(data);
        const result = database.prepare(`INSERT INTO wd_task_categories (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`).run(...Object.values(data));
        return { id: Number(result.lastInsertRowid), ...data };
      });
    },
    async find(hostId, id, transaction) {
      assert.ok(transactions.includes(transaction));
      return row(database.prepare('SELECT * FROM wd_task_categories WHERE hostId = ? AND id = ? AND isDeleted = 0').get(hostId, id));
    },
    async detail(hostId, id) {
      return row(database.prepare(`SELECT c.*, (SELECT COUNT(*) FROM wd_tasks t WHERE t.hostId = c.hostId AND t.taskCategoryId = c.id) taskCount
        FROM wd_task_categories c WHERE hostId = ? AND id = ? AND isDeleted = 0`).get(hostId, id));
    },
    async countTasks(hostId, id) {
      return database.prepare('SELECT COUNT(*) count FROM wd_tasks WHERE hostId = ? AND taskCategoryId = ?').get(hostId, id).count;
    },
    async update(category, data, transaction) {
      assert.ok(transactions.includes(transaction));
      return write(() => {
        const keys = Object.keys(data);
        database.prepare(`UPDATE wd_task_categories SET ${keys.map((key) => `${key} = ?`).join(',')} WHERE id = ? AND hostId = ?`)
          .run(...Object.values(data), category.id, category.hostId);
        return { ...category, ...data };
      });
    },
  };
  const service = new TaskCategoryService(repository, async () => {
    database.exec('BEGIN');
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' }, committed: false, rolledBack: false,
      async commit() { database.exec('COMMIT'); this.committed = true; },
      async rollback() { database.exec('ROLLBACK'); this.rolledBack = true; },
    };
    transactions.push(transaction);
    return transaction;
  });
  const create = (data = {}) => service.create({ ...admin, name: 'Projects', taskNumberPrefix: 'PRJ', ...data });
  return { database, service, repository, transactions, create };
}

test('category create trims fields, defaults counter/status, and preserves host isolation', async (t) => {
  const h = harness(t);
  const { category } = await h.create({ name: ' Projects ', taskNumberPrefix: ' PRJ ', description: ' Details ' });
  assert.equal(category.hostId, 7);
  assert.equal(category.name, 'Projects');
  assert.equal(category.description, 'Details');
  assert.equal(category.taskNumberPrefix, 'PRJ');
  assert.equal(category.nextTaskNumber, 1);
  assert.equal(category.isEnabled, 1);
  assert.ok(Number.isInteger(category.createdAt));
  await h.create({ hostId: 8 });
  await assert.rejects(h.service.detail({ hostId: 9, isAdmin: true, taskCategoryId: category.id }), { code: 'TASK_CATEGORY_NOT_FOUND' });
});

test('duplicate non-deleted names and equivalent prefixes are rejected, including disabled categories', async (t) => {
  const h = harness(t);
  await h.create({ isEnabled: 0 });
  await assert.rejects(h.create({ name: 'projects', taskNumberPrefix: 'OTHER' }), { code: 'TASK_CATEGORY_NAME_EXISTS', statusCode: 409 });
  await assert.rejects(h.create({ name: 'Other', taskNumberPrefix: 'prj-' }), { code: 'TASK_CATEGORY_PREFIX_EXISTS', statusCode: 409 });
});

test('category updates preserve sequence and existing task numbers; conflicts roll back', async (t) => {
  const h = harness(t);
  const { category } = await h.create();
  await h.create({ name: 'Other', taskNumberPrefix: 'OTHER' });
  h.database.prepare('UPDATE wd_task_categories SET nextTaskNumber = 41 WHERE id = ?').run(category.id);
  h.database.prepare("INSERT INTO wd_tasks VALUES (1, 7, ?, 0, 'PRJ-40')").run(category.id);
  const updated = await h.service.update({ ...admin, taskCategoryId: category.id, name: 'Updated', description: null, taskNumberPrefix: 'NEW' });
  assert.equal(updated.category.nextTaskNumber, 41);
  assert.equal(updated.category.taskNumberPrefix, 'NEW');
  assert.equal(h.database.prepare('SELECT taskNumber FROM wd_tasks WHERE id = 1').get().taskNumber, 'PRJ-40');
  await assert.rejects(h.service.update({ ...admin, taskCategoryId: category.id, taskNumberPrefix: 'OTHER-' }), { statusCode: 409 });
  assert.equal((await h.service.detail({ ...admin, taskCategoryId: category.id })).category.taskNumberPrefix, 'NEW');
  await assert.rejects(h.service.update({ ...admin, taskCategoryId: category.id, nextTaskNumber: 1 }), { code: 'CATEGORY_COUNTER_READ_ONLY' });
});

test('soft deletion releases active unique keys but never modifies tasks; used categories cannot be deleted', async (t) => {
  const h = harness(t);
  const { category } = await h.create();
  h.database.prepare("INSERT INTO wd_tasks VALUES (1, 7, ?, 1, 'PRJ-1')").run(category.id);
  await assert.rejects(h.service.remove({ ...admin, taskCategoryId: category.id }), { code: 'TASK_CATEGORY_IN_USE' });
  assert.equal((await h.service.detail({ ...admin, taskCategoryId: category.id })).category.taskCount, 1);
  const { category: unused } = await h.create({ name: 'Unused', taskNumberPrefix: 'UNUSED' });
  await h.service.remove({ ...admin, taskCategoryId: unused.id });
  const deleted = h.database.prepare('SELECT * FROM wd_task_categories WHERE id = ?').get(unused.id);
  assert.equal(deleted.isDeleted, 1);
  assert.ok(deleted.deletedAt > 0);
  await assert.rejects(h.service.toggleStatus({ ...admin, taskCategoryId: unused.id, isEnabled: 1 }), { statusCode: 404 });
  await h.create({ name: 'Unused', taskNumberPrefix: 'UNUSED' });
  assert.equal(h.database.prepare('SELECT COUNT(*) count FROM wd_tasks').get().count, 1);
});

test('toggle status is explicit and cross-host mutations cannot access a category', async (t) => {
  const h = harness(t);
  const { category } = await h.create();
  assert.equal((await h.service.toggleStatus({ ...admin, taskCategoryId: category.id, isEnabled: 0 })).category.isEnabled, 0);
  assert.equal((await h.service.toggleStatus({ ...admin, taskCategoryId: category.id, isEnabled: 1 })).category.isEnabled, 1);
  for (const [action, fields] of [['update', { name: 'Stolen' }], ['remove', {}], ['toggleStatus', { isEnabled: 1 }]]) {
    await assert.rejects(h.service[action]({ ...admin, hostId: 8, taskCategoryId: category.id, ...fields }), { statusCode: 404 });
  }
});

test('category validation rejects invalid fields, pagination, sorting and employee writes', async (t) => {
  const h = harness(t);
  for (const fields of [
    { name: '' }, { name: 'x'.repeat(101) }, { taskNumberPrefix: '' }, { taskNumberPrefix: 'x'.repeat(21) },
    { description: 'x'.repeat(501) }, { description: 1 }, { isEnabled: true }, { nextTaskNumber: 3 },
    { isAdmin: false }, { hostId: 0 },
  ]) await assert.rejects(h.create(fields));
  for (const fields of [{ page: 0 }, { page: null }, { limit: false }, { limit: '' }, { limit: 101 }, { sortBy: 'name; DROP TABLE' }, { search: {} }, { isEnabled: 2 }]) {
    await assert.rejects(h.service.list({ ...admin, ...fields }));
  }
});

test('category list repository applies host/search/status/pagination and batches task counts', async (t) => {
  const h = harness(t);
  await h.create();
  await h.create({ hostId: 8, name: 'Other', taskNumberPrefix: 'OTHER' });
  stubCategoryQueries(t, h.database);
  const service = new TaskCategoryService(new TaskCategoryRepository());
  const result = await service.list({ ...admin, page: 1, limit: 10, search: 'Proj', isEnabled: 1 });
  assert.equal(result.pagination.total, 1);
  assert.equal(result.categories.length, 1);
  assert.equal(result.categories[0].name, 'Projects');
  assert.equal(result.categories[0].taskCount, 0);
  const detail = await service.detail({ ...admin, taskCategoryId: result.categories[0].id });
  assert.equal(detail.category.name, 'Projects');
  assert.equal(detail.category.taskCount, 0);
});

test('category list returns all matches by default and opts into pagination with either parameter', async (t) => {
  const h = harness(t);
  for (let index = 124; index >= 0; index--) {
    const suffix = String(index).padStart(3, '0');
    await h.create({ name: `Category ${suffix}`, taskNumberPrefix: `P${suffix}`, isEnabled: index % 2 === 0 ? 1 : 0 });
  }
  await h.create({ hostId: 8, name: 'Other host', taskNumberPrefix: 'OTHER' });
  const { category: deleted } = await h.create({ name: 'Deleted', taskNumberPrefix: 'DELETED' });
  await h.service.remove({ ...admin, taskCategoryId: deleted.id });
  const query = stubCategoryQueries(t, h.database);
  const service = new TaskCategoryService(new TaskCategoryRepository());

  const all = await service.list(admin);
  assert.equal(all.categories.length, 125);
  assert.equal(Object.hasOwn(all, 'pagination'), false);
  assert.equal(all.categories[0].name, 'Category 000');
  assert.equal(all.categories[124].name, 'Category 124');
  for (const call of query.mock.calls) assert.doesNotMatch(call.arguments[0], /\b(LIMIT|OFFSET)\b/i);

  const filtered = await service.list({ ...admin, search: 'Category 0', isEnabled: 1 });
  assert.equal(filtered.categories.length, 50);
  assert.equal(Object.hasOwn(filtered, 'pagination'), false);
  assert.ok(filtered.categories.every((category) => category.isEnabled === 1 && category.name.startsWith('Category 0')));

  const page = await service.list({ ...admin, page: 2, limit: 10, isEnabled: 1 });
  assert.equal(page.categories.length, 10);
  assert.equal(page.categories[0].name, 'Category 020');
  assert.deepEqual(page.pagination, { page: 2, limit: 10, total: 63, totalPages: 7 });

  const pageOnly = await service.list({ ...admin, page: 2 });
  assert.equal(pageOnly.categories.length, 20);
  assert.equal(pageOnly.categories[0].name, 'Category 020');
  assert.deepEqual(pageOnly.pagination, { page: 2, limit: 20, total: 125, totalPages: 7 });

  const limitOnly = await service.list({ ...admin, limit: '7' });
  assert.equal(limitOnly.categories.length, 7);
  assert.equal(limitOnly.categories[0].name, 'Category 000');
  assert.deepEqual(limitOnly.pagination, { page: 1, limit: 7, total: 125, totalPages: 18 });
});

test('unpaginated category list returns an empty array without pagination for an empty host', async (t) => {
  const h = harness(t);
  stubCategoryQueries(t, h.database);
  assert.deepEqual(await new TaskCategoryService(new TaskCategoryRepository()).list(admin), {
    categories: [],
  });
});

test('task category reassignment keeps task number/counters and validates target category', async () => {
  const task = { id: 1, hostId: 7, taskCategoryId: 1, taskNumber: 'OLD-41', status: 'PENDING' };
  let increments = 0;
  const transaction = { async commit() {}, async rollback() {} };
  const service = new TaskService({
    async lockTaskCategory(hostId, id) {
      return hostId === 7 && id === 2 ? { id, isEnabled: 1, nextTaskNumber: 50 } : null;
    },
    async getTask() { return task; },
    async updateTask(row, data) { Object.assign(row, data); },
    async createLog() {},
    async advanceTaskNumber() { increments++; },
  }, async () => transaction);
  await service.updateTask({ ...admin, userId: 9, taskId: 1, taskCategoryId: 2 });
  assert.equal(task.taskCategoryId, 2);
  assert.equal(task.taskNumber, 'OLD-41');
  assert.equal(increments, 0);
  await assert.rejects(service.updateTask({ ...admin, userId: 9, taskId: 1, taskCategoryId: 99 }), { code: 'TASK_CATEGORY_NOT_FOUND' });
});

test('task list/detail category includes stay host-scoped and preserve tasks with disabled categories', async (t) => {
  t.mock.method(Task, 'findOne', async (options) => options);
  const options = await new TaskRepository().getTask(7, 1);
  const include = options.include.find((item) => item.as === 'taskCategory');
  assert.deepEqual(include.where, { hostId: 7 });
  assert.equal(include.required, false);
  assert.deepEqual(include.attributes, ['id', 'name', 'taskNumberPrefix']);
  assert.equal(Task.associations.taskCategory.target, TaskCategory);
  assert.equal(TaskCategory.associations.tasks.target, Task);
  assert.equal(TaskCategory.associations.host.target, Host);
});

test('category controller ignores client host/admin privileges and preserves standard envelope', async (t) => {
  const h = harness(t);
  t.mock.method(categoryService, 'create', (payload) => h.service.create(payload));
  let body;
  const res = { json(data) { body = data; } };
  await new TaskCategoryController().create({
    user: { hostId: 7, isAdminUser: 1 },
    body: { hostId: 8, isAdmin: false, name: 'Projects', taskNumberPrefix: 'PRJ' },
  }, res, assert.ifError);
  assert.equal(body.success, true);
  assert.equal(body.data.category.hostId, 7);
  let error;
  await new TaskCategoryController().create({
    user: { hostId: 7, isAdminUser: 0 },
    body: { isAdmin: true, name: 'Other', taskNumberPrefix: 'OTHER' },
  }, res, (value) => { error = value; });
  assert.equal(error.statusCode, 403);
});

test('category CRUD HTTP routes enforce JWT/admin/CSRF and serialize plain category responses', async (t) => {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const jwt = require('jsonwebtoken');
  const { once } = require('node:events');
  const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
  const { authMiddleware, requireAdminRole } = require('../../src/shared/middleware/auth.middleware');
  const { requireAdminCsrfToken } = require('../../src/shared/middleware/csrf.middleware');
  const { getAdminCsrfCookieName } = require('../../src/shared/utils/auth-cookie.util');
  const { requireSupportReadOnlyPolicy } = require('../../src/shared/middleware/support-access.middleware');
  const { errorHandler } = require('../../src/shared/middleware/error-handler.middleware');
  const serializer = require('../../src/shared/middleware/response-serializer.middleware').default;
  const routes = require('../../src/routes/v1/admin/tasks.routes').default;
  const h = harness(t);
  const createCategory = h.repository.create.bind(h.repository);
  h.repository.create = async (data) => TaskCategory.build(await createCategory(data));
  h.repository.list = async () => ({
    rows: h.database.prepare('SELECT *, 0 AS taskCount FROM wd_task_categories WHERE hostId = 7 AND isDeleted = 0').all(),
    count: h.database.prepare('SELECT COUNT(*) count FROM wd_task_categories WHERE hostId = 7 AND isDeleted = 0').get().count,
  });
  for (const action of ['list', 'detail', 'create', 'update', 'remove', 'toggleStatus']) {
    t.mock.method(categoryService, action, (payload) => h.service[action](payload));
  }
  let user = { id: 9, hostId: '7', isAdminUser: 1, accountStatus: 'ACTIVE' };
  t.mock.method(userRepository, 'findById', async () => user);
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(serializer);
  app.use('/api/v1/admin', authMiddleware, requireAdminRole, requireAdminCsrfToken, requireSupportReadOnlyPolicy);
  app.use('/api/v1/admin/tasks', routes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const token = jwt.sign({ userId: 9, tokenType: 'access' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  async function send(action, payload = {}, options = {}) {
    const res = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/tasks/task-categories/${action}`, {
      method: 'POST', body: JSON.stringify(payload),
      headers: {
        'Content-Type': 'application/json',
        ...(options.auth === false ? {} : { Authorization: `Bearer ${token}` }),
        ...(options.csrf === false ? {} : { Cookie: `${getAdminCsrfCookieName()}=category-test`, 'x-csrf-token': 'category-test' }),
      },
    });
    return { status: res.status, body: await res.json() };
  }
  assert.equal((await send('list', {}, { auth: false })).status, 401);
  assert.equal((await send('create', {}, { csrf: false })).status, 401);
  const created = await send('create', { name: 'Projects', taskNumberPrefix: 'PRJ', hostId: 999 });
  assert.equal(created.status, 200);
  assert.equal(created.body.data.category.hostId, 7);
  assert.equal(created.body.data.category.dataValues, undefined);
  const id = created.body.data.category.id;
  const listed = await send('list');
  assert.equal(listed.body.data.categories.length, 1);
  assert.equal(Object.hasOwn(listed.body.data, 'pagination'), false);
  assert.equal((await send('detail', { taskCategoryId: id })).body.data.category.taskCount, 0);
  assert.equal((await send('update', { taskCategoryId: id, name: 'Updated' })).body.data.category.name, 'Updated');
  assert.equal((await send('toggle-status', { taskCategoryId: id, isEnabled: 0 })).body.data.category.isEnabled, 0);
  assert.equal((await send('delete', { taskCategoryId: id })).body.data.taskCategoryId, id);
  assert.equal((await send('detail', { taskCategoryId: id })).status, 404);
  assert.equal((await send('list', [])).status, 400);
  user = { ...user, isAdminUser: 0 };
  assert.equal((await send('create', { isAdmin: true, name: 'Other', taskNumberPrefix: 'OTHER' })).status, 403);
});
