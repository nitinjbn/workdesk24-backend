require('ts-node/register/transpile-only');
process.env.JWT_SECRET = 'task-tag-test-signing-key';

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op, UniqueConstraintError } = require('sequelize');
const { Task, TaskTag, TaskTagMapping, sequelize } = require('../../src/models');
const { TaskTagService } = require('../../src/modules/task/services/task-tag.service');
const tagService = require('../../src/modules/task/services/task-tag.service').default;
const { TaskTagRepository } = require('../../src/modules/task/repositories/task-tag.repository');
const tagRepository = require('../../src/modules/task/repositories/task-tag.repository').default;
const { TaskService } = require('../../src/modules/task/services/task.service');
const taskService = require('../../src/modules/task/services/task.service').default;
const { TaskRepository } = require('../../src/modules/task/repositories/task.repository');
const hostSettings = require('../../src/shared/utils/host-settings.util');

const admin = { hostId: 7, userId: 9, isAdmin: true };
const employee = { hostId: 7, userId: 22, isAdmin: false };

// Persistence is in memory; migration tests capture SQL without executing it.
test.before(() => test.mock.method(sequelize, 'query', async () => { throw new Error('Unexpected database query'); }));
test.after(() => sequelize.close());

function harness() {
  const tags = new Map();
  const mappings = new Map();
  const tasks = new Map([
    [125, { id: 125, hostId: 7, assignedToUserId: 22, status: 'PENDING', priority: 'HIGH', updatedAt: 100, createdAt: 50, startedAt: null, isDeleted: 0 }],
    [126, { id: 126, hostId: 8, assignedToUserId: 22, isDeleted: 0 }],
    [127, { id: 127, hostId: 7, assignedToUserId: 33, isDeleted: 0 }],
    [128, { id: 128, hostId: 7, assignedToUserId: 22, isDeleted: 1 }],
  ]);
  const transactions = [];
  let failWrite = false;
  const transactionFactory = async () => {
    const snapshot = structuredClone({ tags: [...tags], mappings: [...mappings], tasks: [...tasks] });
    const transaction = {
      LOCK: { UPDATE: 'UPDATE' }, committed: false, rolledBack: false,
      async commit() { this.committed = true; },
      async rollback() {
        this.rolledBack = true;
        for (const [store, entries] of [[tags, snapshot.tags], [mappings, snapshot.mappings], [tasks, snapshot.tasks]]) {
          store.clear();
          for (const [key, value] of entries) store.set(key, value);
        }
      },
    };
    transactions.push(transaction);
    return transaction;
  };
  const duplicate = (data, excluding) => {
    if ([...tags.values()].some((tag) => tag.id !== excluding && tag.hostId === data.hostId
      && tag.name.toLowerCase() === data.name.toLowerCase())) throw new UniqueConstraintError({ errors: [] });
  };
  const repository = {
    async create(data) {
      duplicate(data);
      const tag = { id: tags.size + 1, updatedAt: null, deletedAt: null, ...data };
      tags.set(tag.id, tag);
      return TaskTag.build(tag);
    },
    async find(hostId, id) {
      const tag = tags.get(id);
      return tag && tag.hostId === hostId && tag.isDeleted === 0 ? TaskTag.build(tag) : null;
    },
    async list(hostId, search, enabled) {
      return [...tags.values()].filter((tag) => tag.hostId === hostId && !tag.isDeleted
        && (enabled === undefined || tag.isEnabled === enabled) && (!search || tag.name.includes(search)))
        .sort((a, b) => a.name.localeCompare(b.name)).map((tag) => TaskTag.build(tag));
    },
    async update(tag, data, transaction) {
      assert.ok(transactions.includes(transaction));
      const updated = { ...tags.get(tag.id), ...data };
      duplicate(updated, tag.id);
      tags.set(tag.id, updated);
      return TaskTag.build(updated);
    },
    async findMappings(hostId, taskId, transaction) {
      assert.ok(transactions.includes(transaction));
      return [...mappings.values()].filter((mapping) => mapping.hostId === hostId && mapping.taskId === taskId);
    },
    async lockTags(hostId, ids, transaction) {
      assert.ok(transactions.includes(transaction));
      return [...tags.values()].filter((tag) => tag.hostId === hostId && ids.includes(tag.id)).map((tag) => TaskTag.build(tag));
    },
    async replaceMappings(hostId, taskId, changes, now, transaction) {
      assert.ok(transactions.includes(transaction));
      for (const id of changes.removeIds) mappings.set(id, { ...mappings.get(id), isDeleted: 1, updatedAt: now, deletedAt: now });
      for (const id of changes.restoreIds) mappings.set(id, { ...mappings.get(id), isDeleted: 0, updatedAt: now, deletedAt: null });
      for (const tagId of changes.newTagIds) {
        assert.ok(![...mappings.values()].some((mapping) => mapping.hostId === hostId && mapping.taskId === taskId && mapping.tagId === tagId));
        const id = mappings.size + 1;
        mappings.set(id, { id, hostId, taskId, tagId, isDeleted: 0, createdAt: now });
      }
      if (failWrite) throw new Error('mapping persistence failed');
    },
    async tagsForTasks(hostId, taskIds) {
      const result = new Map();
      for (const mapping of mappings.values()) {
        const tag = tags.get(mapping.tagId);
        if (mapping.hostId !== hostId || mapping.isDeleted || !taskIds.includes(mapping.taskId) || tag.hostId !== hostId) continue;
        const entries = result.get(String(mapping.taskId)) || [];
        entries.push({ id: tag.id, name: tag.name, color: tag.color, isEnabled: tag.isEnabled, isDeleted: tag.isDeleted });
        result.set(String(mapping.taskId), entries);
      }
      return result;
    },
  };
  const master = new TaskTagService(repository, transactionFactory);
  const service = new TaskService({
    async getTask(hostId, taskId, transaction, lock) {
      assert.ok(transactions.includes(transaction));
      assert.equal(lock, true);
      const task = tasks.get(taskId);
      return task && task.hostId === hostId && !task.isDeleted ? Task.build(task) : null;
    },
  }, transactionFactory, {}, repository);
  const create = (fields = {}) => master.create({ ...admin, name: 'Urgent', color: '#ff00aa', ...fields });
  const assign = (tagIds, scope = employee, taskId = 125) => service.updateTags({ ...scope, taskId, tagIds });
  return { tags, mappings, tasks, master, service, repository, transactions, create, assign, fail() { failWrite = true; } };
}

test('tag CRUD validates fields, reserves case-insensitive names, changes colors, and soft-deletes', async () => {
  const h = harness();
  const { tag } = await h.create({ name: ' Urgent ', description: ' Details ' });
  assert.equal(tag.name, 'Urgent');
  assert.equal(tag.color, '#FF00AA');
  assert.equal(tag.description, 'Details');
  await assert.rejects(h.create({ name: 'urgent' }), { code: 'TASK_TAG_NAME_EXISTS', statusCode: 409 });
  await h.create({ hostId: 8 });
  for (const fields of [
    { name: '' }, { name: 'x'.repeat(51) }, { color: '#123' }, { color: 'FFFFFF' },
    { color: '#GG0000' }, { color: '#123456\n' }, { description: 'x'.repeat(256) }, { isEnabled: true },
  ]) await assert.rejects(h.create(fields), { statusCode: 400 });
  const changed = await h.master.update({ ...admin, tagId: tag.id, color: '#abcdef', description: null });
  assert.equal(changed.tag.color, '#ABCDEF');
  assert.equal(changed.tag.description, null);
  await h.master.toggleStatus({ ...admin, tagId: tag.id, isEnabled: 0 });
  assert.deepEqual((await h.master.listEnabled(employee)).tags, []);
  await h.master.remove({ ...admin, tagId: tag.id });
  assert.equal(h.tags.get(tag.id).isDeleted, 1);
  assert.ok(h.tags.get(tag.id).deletedAt > 0);
  assert.equal(h.tags.size, 2);
  assert.deepEqual((await h.master.list(admin)).tags, []);
  await assert.rejects(h.create(), { code: 'TASK_TAG_NAME_EXISTS' });
  await assert.rejects(h.master.detail({ ...admin, tagId: tag.id }), { statusCode: 404 });
});

test('all master operations reject employees and cross-host access', async () => {
  const h = harness();
  const { tag } = await h.create();
  for (const action of ['list', 'create', 'update', 'detail', 'remove', 'toggleStatus']) {
    await assert.rejects(h.master[action]({ ...employee, tagId: tag.id, name: 'Other', color: '#123456', isEnabled: 0 }), { statusCode: 403 });
  }
  for (const action of ['detail', 'update', 'remove', 'toggleStatus']) {
    await assert.rejects(h.master[action]({
      ...admin, hostId: 8, tagId: tag.id,
      ...(action === 'toggleStatus' ? { isEnabled: 0 } : { name: 'Other' }),
    }), { statusCode: 404 });
  }
  assert.equal((await h.master.listEnabled(employee)).tags.length, 1);
});

test('employees replace authorized task tags, deduplicate input, remove and restore mappings without changing tasks', async () => {
  const h = harness();
  const first = (await h.create()).tag.id;
  const second = (await h.create({ name: 'Review' })).tag.id;
  const original = structuredClone([...h.tasks]);
  const result = await h.assign([first, String(second), first]);
  assert.deepEqual(result.tags.map((tag) => tag.id), [first, second]);
  assert.equal(h.mappings.size, 2);
  const mapping = structuredClone(h.mappings.get(1));
  assert.deepEqual((await h.assign([])).tags, []);
  assert.equal(h.mappings.size, 2);
  assert.ok([...h.mappings.values()].every((entry) => entry.isDeleted === 1 && entry.deletedAt > 0));
  await h.assign([first], admin);
  assert.equal(h.mappings.size, 2);
  assert.equal(h.mappings.get(1).isDeleted, 0);
  assert.equal(h.mappings.get(1).createdAt, mapping.createdAt);
  assert.equal(h.mappings.get(1).deletedAt, null);
  assert.deepEqual([...h.tasks], original);
  assert.ok(h.transactions.every((transaction) => transaction.committed));
});

test('assignment rejects unauthorized/deleted/cross-host tasks and cross-host tags atomically', async () => {
  const h = harness();
  const local = (await h.create()).tag.id;
  const foreign = (await h.create({ hostId: 8 })).tag.id;
  for (const taskId of [126, 127, 128, 999]) {
    await assert.rejects(h.assign([local], employee, taskId), { statusCode: 404 });
  }
  await assert.rejects(h.assign([local, foreign]), { code: 'TASK_TAG_NOT_FOUND', statusCode: 404 });
  for (const ids of [null, '1', {}, [false], [1.5], ['1e2'], ['1\n'], [0], [Number.MAX_SAFE_INTEGER + 1]]) {
    await assert.rejects(h.assign(ids), { statusCode: 400 });
  }
  assert.equal(h.mappings.size, 0);
  assert.ok(h.transactions.every((transaction) => transaction.rolledBack));
});

test('disabled/deleted tags cannot be newly assigned; historical references survive active-tag replacement', async () => {
  const h = harness();
  const enabled = (await h.create()).tag.id;
  const disabled = (await h.create({ name: 'Disabled' })).tag.id;
  const deleted = (await h.create({ name: 'Deleted' })).tag.id;
  await h.assign([enabled, disabled, deleted]);
  await h.master.toggleStatus({ ...admin, tagId: disabled, isEnabled: 0 });
  await h.master.remove({ ...admin, tagId: deleted });
  const history = await h.assign([]);
  assert.deepEqual(history.tags.map((tag) => tag.id), [disabled, deleted]);
  assert.equal(history.tags[0].isEnabled, 0);
  assert.equal(history.tags[1].isDeleted, 1);
  assert.equal(h.mappings.size, 3);
  await h.assign([disabled, deleted]);
  assert.equal(h.tags.get(disabled).isEnabled, 0);
  for (const tagId of [disabled, deleted]) {
    await assert.rejects(h.assign([tagId], employee, 127), { statusCode: 404 });
    await assert.rejects(h.assign([tagId], admin, 127), { code: 'TASK_TAG_UNAVAILABLE' });
  }
});

test('assignment rollback restores previous mappings when persistence fails', async () => {
  const h = harness();
  const first = (await h.create()).tag.id;
  const second = (await h.create({ name: 'Review' })).tag.id;
  await h.assign([first]);
  const original = structuredClone([...h.mappings]);
  h.fail();
  await assert.rejects(h.assign([second]), /mapping persistence failed/);
  assert.deepEqual([...h.mappings], original);
  assert.equal(h.transactions.at(-1).rolledBack, true);
});

test('tag repository scopes reads and soft-writes, locks rows, and uses one batched historical tag query', async (t) => {
  const repository = new TaskTagRepository();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const reads = [];
  t.mock.method(TaskTag, 'findAll', async (options) => { reads.push(options); return []; });
  const find = t.mock.method(TaskTag, 'findOne', async (options) => { reads.push(options); return null; });
  await repository.list(7, 'Urg', 1);
  assert.deepEqual(reads[0].where, { hostId: 7, isDeleted: 0, name: { [Op.like]: '%Urg%' }, isEnabled: 1 });
  await repository.find(7, 3, transaction);
  assert.equal(find.mock.calls[0].arguments[0].lock, 'UPDATE');
  await repository.lockTags(7, [3, 1], transaction);
  assert.equal(reads.at(-1).where.hostId, 7);
  assert.equal(reads.at(-1).where.isEnabled, undefined);
  assert.deepEqual(reads.at(-1).order, [['id', 'ASC']]);
  const updates = t.mock.method(TaskTagMapping, 'update', async () => [1]);
  const inserts = t.mock.method(TaskTagMapping, 'bulkCreate', async () => []);
  await repository.replaceMappings(7, 125, { removeIds: [1], restoreIds: [2], newTagIds: [4, 5] }, 1234, transaction);
  assert.equal(updates.mock.calls.length, 2);
  for (const call of updates.mock.calls) {
    assert.equal(call.arguments[1].where.hostId, 7);
    assert.equal(call.arguments[1].where.taskId, 125);
    assert.equal(call.arguments[1].transaction, transaction);
  }
  assert.equal(inserts.mock.calls[0].arguments[0].length, 2);
  const batch = t.mock.method(TaskTagMapping, 'findAll', async (options) => {
    assert.deepEqual(options.where, { hostId: 7, taskId: { [Op.in]: [125, 127] }, isDeleted: 0 });
    assert.deepEqual(options.include[0].where, { hostId: 7 });
    return [{ taskId: '125', tag: { id: 3, name: 'History', color: '#000000', isEnabled: 0, isDeleted: 1 } }];
  });
  const tags = await repository.tagsForTasks(7, [125, 127]);
  assert.equal(batch.mock.callCount(), 1);
  assert.equal(tags.get('125')[0].isDeleted, 1);
  assert.equal(tags.get('125')[0].isEnabled, 0);
  await repository.tagsForTasks(7, []);
  assert.equal(batch.mock.callCount(), 1);
});

test('task tag OR filter uses a tenant-scoped EXISTS, preserving distinct counts, pagination and batched tags', async (t) => {
  const repository = new TaskRepository();
  const queries = [];
  const fixtures = [
    { id: 1, hostId: 7, assignedToUserId: 22, tags: [1, 2] },
    { id: 2, hostId: 7, assignedToUserId: 22, tags: [2] },
    { id: 3, hostId: 7, assignedToUserId: 22, tags: [3] },
    { id: 4, hostId: 8, assignedToUserId: 22, tags: [1] },
  ];
  t.mock.method(sequelize, 'query', async (sql, options) => {
    queries.push(sql);
    assert.match(sql, /EXISTS\s*\(/);
    assert.match(sql, /tagMapping\.hostId = 7/);
    assert.match(sql, /filterTag\.hostId = tagMapping\.hostId/);
    assert.match(sql, /tagMapping\.isDeleted = 0/);
    assert.match(sql, /tagMapping\.tagId IN \(1,2\)/);
    assert.match(sql, /`Task`\.`hostId` = 7/);
    assert.match(sql, /`Task`\.`assignedToUserId` = 22/);
    assert.doesNotMatch(sql, /LEFT OUTER JOIN `wd_task_tag_mappings`/);
    const matches = fixtures.filter((row) => row.hostId === 7 && row.tags.some((id) => [1, 2].includes(id)));
    if (options.plain) {
      assert.match(sql, /count\(DISTINCT/i);
      return { count: matches.length };
    }
    assert.match(sql, /LIMIT 1, 1/);
    return matches.slice(1, 2).map(({ tags, ...row }) => Task.build(row));
  });
  const batch = t.mock.method(tagRepository, 'tagsForTasks', async (hostId, ids) => {
    assert.equal(hostId, 7);
    assert.deepEqual(ids, [2]);
    return new Map([['2', [{ id: 2, name: 'Review', color: '#000000', isEnabled: 1, isDeleted: 0 }]]]);
  });
  const result = await repository.listTasks({
    ...employee, filters: { tagIds: [1, 2] }, sortBy: 'id', sortOrder: 'ASC', overdueCutoff: 100,
    page: 2, limit: 1,
  });
  assert.equal(result.count, 2);
  assert.equal(result.rows.length, 1);
  assert.equal(result.rows[0].id, 2);
  assert.equal(result.rows[0].toJSON().tags[0].name, 'Review');
  assert.equal(queries.length, 2);
  assert.equal(batch.mock.callCount(), 1);
});

test('task list/detail attach tags and normalize single/multiple filter IDs without weakening employee scope', async (t) => {
  t.mock.method(hostSettings, 'getHostDateTimeSettings', async () => ({ timeZone: 'UTC', dateFormat: 'YYYY-MM-DD', dateTimeFormat: 'YYYY-MM-DD HH:mm', timeFormat: 'HH:mm' }));
  const calls = [];
  const service = new TaskService({ async listTasks(params) { calls.push(params); return { rows: [], count: 0 }; } });
  for (const [filters, expected] of [[{ tagId: '2' }, [2]], [{ tagIds: [1, '2', 1] }, [1, 2]], [{ tagIds: [] }, undefined]]) {
    await service.listTasks({ ...employee, filters });
    assert.deepEqual(calls.at(-1).filters.tagIds, expected);
    assert.equal(calls.at(-1).filters.tagId, undefined);
    assert.equal(calls.at(-1).isAdmin, false);
  }
  for (const filters of [{ tagIds: '1' }, { tagIds: [true] }, { tagId: 1, tagIds: [2] }]) {
    await assert.rejects(service.listTasks({ ...employee, filters }), { statusCode: 400 });
  }
  t.mock.method(Task, 'findOne', async () => Task.build({ id: 125, hostId: 7, assignedToUserId: 22 }));
  t.mock.method(tagRepository, 'tagsForTasks', async () => new Map([['125', [{ id: 2, name: 'Review', color: '#000000', isEnabled: 0, isDeleted: 0 }]]]));
  const detail = new TaskService({
    getTask: (...args) => new TaskRepository().getTask(...args),
    async getComments() { return { rows: [] }; },
    async getAttachments() { return { rows: [] }; },
    async getLogs() { return { rows: [] }; },
  });
  const result = await detail.getTaskDetails({ ...employee, taskId: 125 });
  assert.equal(result.task.tags[0].isEnabled, 0);
  await assert.rejects(detail.getTaskDetails({ ...employee, userId: 33, taskId: 125 }), { statusCode: 404 });
});

test('tag HTTP endpoints reuse JWT/admin/CSRF policies, authenticated identity and employee task access', async (t) => {
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
  const h = harness();
  for (const action of ['list', 'listEnabled', 'create', 'update', 'detail', 'remove', 'toggleStatus']) {
    t.mock.method(tagService, action, (payload) => h.master[action](payload));
  }
  t.mock.method(taskService, 'updateTags', (payload) => h.service.updateTags(payload));
  let user = { id: 9, hostId: '7', isAdminUser: 1, accountStatus: 'ACTIVE' };
  t.mock.method(userRepository, 'findById', async () => user);
  const app = express();
  app.use(express.json(), cookieParser(), serializer);
  app.use('/api/v1/admin', authMiddleware, requireAdminRole, requireAdminCsrfToken, requireSupportReadOnlyPolicy);
  app.use('/api/v1/admin/tasks', require('../../src/routes/v1/admin/tasks.routes').default);
  app.use('/api/v1/app/task', authMiddleware, require('../../src/routes/v1/app/tasks.routes').default);
  app.use((_req, res) => res.status(404).json({ success: false }));
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  t.after(async () => { server.closeAllConnections(); await new Promise((resolve) => server.close(resolve)); });
  const token = jwt.sign({ userId: 9, tokenType: 'access' }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const send = async (path, body = {}, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/${path}`, {
      method: 'POST', body: JSON.stringify(body),
      headers: {
        'Content-Type': 'application/json',
        ...(options.auth === false ? {} : { Authorization: `Bearer ${token}` }),
        ...(options.csrf === false ? {} : { Cookie: `${getAdminCsrfCookieName()}=tag-test`, 'x-csrf-token': 'tag-test' }),
      },
    });
    return { status: response.status, body: await response.json() };
  };
  assert.equal((await send('admin/tasks/task-tags/list', {}, { auth: false })).status, 401);
  assert.equal((await send('admin/tasks/task-tags/create', {}, { csrf: false })).status, 401);
  const created = await send('admin/tasks/task-tags/create', { name: 'Urgent', color: '#FF0000', hostId: 999 });
  assert.equal(created.status, 200);
  assert.equal(created.body.data.tag.hostId, 7);
  assert.equal(created.body.data.tag.dataValues, undefined);
  const tagId = created.body.data.tag.id;
  user = { ...user, id: 22, isAdminUser: 0 };
  for (const action of ['list', 'create', 'update', 'detail', 'delete', 'toggle-status']) {
    assert.equal((await send(`admin/tasks/task-tags/${action}`, { tagId, isAdmin: true, isEnabled: 0 })).status, 403);
  }
  assert.equal((await send('app/task/task-tags/list', { isEnabled: 0, hostId: 999 })).body.data.tags.length, 1);
  assert.equal((await send('app/task/task-tags/create')).status, 404);
  assert.equal((await send('app/task/update-tags', { taskId: 125, tagIds: [tagId], hostId: 999, isAdmin: true })).status, 200);
  assert.equal((await send('app/task/update-tags', { taskId: 127, tagIds: [tagId], isAdmin: true })).status, 404);
  assert.deepEqual((await send('app/task/update-tags', { taskId: 125, tagIds: [] })).body.data.tags, []);
  assert.equal((await send('app/task/update-tags', {}, { auth: false })).status, 401);
  user = { ...user, id: 9, isAdminUser: 1 };
  assert.equal((await send('admin/tasks/update-tags', { taskId: 125, tagIds: [tagId] })).status, 200);
});

test('manual SQL and migration define matching schemas without executing database queries', async () => {
  const statements = [];
  await require('../../src/migrations/20261114130000-create-task-tags').up({
    sequelize: { async query(sql) { statements.push(sql); } },
  });
  assert.equal(statements.length, 2);
  assert.match(statements[0], /COLLATE=utf8mb4_unicode_ci/);
  assert.match(statements[0], /UNIQUE KEY uq_task_tags_host_name \(hostId, name\)/);
  assert.match(statements[1], /UNIQUE KEY uq_task_tag_mappings_host_task_tag \(hostId, taskId, tagId\)/);
  assert.match(statements[1], /isDeleted TINYINT NOT NULL DEFAULT 0/);
  await assert.rejects(require('../../src/migrations/20261114130000-create-task-tags').down(), /historical mappings/);
});
