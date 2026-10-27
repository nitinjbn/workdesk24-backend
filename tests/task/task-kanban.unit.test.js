require('ts-node/register/transpile-only');

process.env.JWT_SECRET = 'task-kanban-test-signing-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { Op } = require('sequelize');
const { Task } = require('../../src/models');
const { TaskService } = require('../../src/modules/task/services/task.service');
const { TaskRepository } = require('../../src/modules/task/repositories/task.repository');
const taskService = require('../../src/modules/task/services/task.service').default;
const hostSettings = require('../../src/shared/utils/host-settings.util');

const admin = { hostId: 7, userId: 9, isAdmin: true };
const now = Date.parse('2026-10-27T02:33:00Z') / 1000;

function settings(context, timeZone = 'Asia/Kolkata') {
  context.mock.method(Date, 'now', () => now * 1000);
  context.mock.method(hostSettings, 'getHostDateTimeSettings', async (hostId) => {
    assert.equal(hostId, 7);
    return { timeZone, dateFormat: 'DD/MM/YYYY', dateTimeFormat: 'DD/MM/YYYY HH:mm', timeFormat: 'HH:mm' };
  });
}

function task(id, status, dueAt = null) {
  const data = {
    id, hostId: 7, taskNumber: `TASK-${id}`, title: `Title ${id}`, description: 'Description',
    assignedToUserId: 47, createdByUserId: 9, customerId: null, visitId: null, priority: 'URGENT',
    status, dueAt, startedAt: null, completedAt: null, cancelledAt: null, isDeleted: 0,
    createdAt: now, updatedAt: now, deletedAt: null,
    assignedToUser: { id: 47, name: 'John Doe' }, createdByUser: { id: 9, name: 'Admin' },
  };
  return { ...data, toJSON: () => ({ ...data }) };
}

test('Kanban returns all cards once, with exclusive overdue buckets and host-formatted fields', async (context) => {
  settings(context);
  const rows = [
    task(1, 'PENDING'), task(2, 'IN_PROGRESS', now), task(3, 'COMPLETED', now - 1),
    task(4, 'PENDING', now - 1), task(5, 'IN_PROGRESS', now - 1), task(6, 'PENDING', now + 1),
    ...Array.from({ length: 105 }, (_, index) => task(index + 7, 'PENDING')),
  ];
  const query = context.mock.fn(async (params) => {
    assert.equal(params.hostId, 7);
    assert.equal(params.now, now);
    assert.equal(params.sortBy, 'createdAt');
    assert.equal(params.sortOrder, 'DESC');
    assert.equal(params.limit, undefined);
    assert.equal(params.page, undefined);
    return rows;
  });
  const result = await new TaskService({ getKanbanTasks: query }).getKanbanBoard({ ...admin, page: 1, limit: 1 });
  assert.deepEqual(Object.keys(result), ['status', 'timestamp', 'data']);
  assert.equal(result.status, 'success');
  assert.equal(result.timestamp, '2026-10-27 08:03 AM');
  const columns = result.data.columns;
  assert.deepEqual(columns.map(({ columnId, title, statusKey, taskCount }) => ({ columnId, title, statusKey, taskCount })), [
    { columnId: 'col_todo', title: 'To Do', statusKey: 'TODO', taskCount: 107 },
    { columnId: 'col_in_progress', title: 'In Progress', statusKey: 'IN_PROGRESS', taskCount: 1 },
    { columnId: 'col_completed', title: 'Completed', statusKey: 'COMPLETED', taskCount: 1 },
    { columnId: 'col_overdue', title: 'Overdue SLA', statusKey: 'OVERDUE', taskCount: 2 },
  ]);
  const cards = columns.flatMap((column) => {
    assert.deepEqual(Object.keys(column), ['columnId', 'title', 'statusKey', 'taskCount', 'tasks']);
    assert.equal(column.taskCount, column.tasks.length);
    return column.tasks;
  });
  assert.equal(new Set(cards.map((card) => card.id)).size, rows.length);
  assert.deepEqual(columns[3].tasks.map((card) => card.status), ['PENDING', 'IN_PROGRESS']);
  assert.equal(columns[1].tasks[0].dueAt, '27/10/2026');
  assert.deepEqual(columns[0].tasks[0], {
    ...rows[0].toJSON(), createdAt: '27/10/2026 08:03', updatedAt: '27/10/2026 08:03',
  });
  assert.equal(rows[0].createdAt, now);
  assert.equal(query.mock.callCount(), 1);
});

test('Kanban forwards shared employee/search/date filters and custom sort without mutating input', async (context) => {
  settings(context);
  const filters = {
    assignedToUserId: 47, search: 'TASK-23', priority: 'HIGH', status: 'PENDING',
    createdByUserId: 9, customerId: 31, visitId: 41,
    dueDate: '27/10/2026', completedDate: '2026-10-27', overdueOnly: 1,
  };
  const copy = { ...filters };
  let received;
  const service = new TaskService({ async getKanbanTasks(params) { received = params; return []; } });
  const result = await service.getKanbanBoard({ ...admin, filters, sortBy: 'dueAt', sortOrder: 'asc' });
  assert.deepEqual(filters, copy);
  const from = Date.parse('2026-10-26T18:30:00Z') / 1000;
  assert.deepEqual(received, {
    ...admin, filters: {
      assignedToUserId: 47, search: 'TASK-23', priority: 'HIGH', status: 'PENDING',
      createdByUserId: 9, customerId: 31, visitId: 41, overdueOnly: true,
      dueFrom: from, dueTo: from + 86399, completedFrom: from, completedTo: from + 86399,
    },
    sortBy: 'dueAt', sortOrder: 'ASC', now,
  });
  assert.equal(result.data.columns.length, 4);
  for (const column of result.data.columns) {
    assert.equal(column.taskCount, 0);
    assert.deepEqual(column.tasks, []);
  }
});

test('Kanban rejects invalid filters/sorting before querying and propagates failures', async (context) => {
  settings(context);
  const query = context.mock.fn(async () => []);
  const service = new TaskService({ getKanbanTasks: query });
  await assert.rejects(service.getKanbanBoard({ ...admin, isAdmin: false }), { code: 'TASK_ADMIN_REQUIRED' });
  for (const filters of [
    [], 'text', 47, { assignedToUserId: 0 }, { assignedToUserId: 'invalid' },
    ...[[0], [47, null], [[47]], [true], [{}], [-1], [1.5], ['invalid']].map((assignedToUserId) => ({ assignedToUserId })),
    { search: 3 }, { search: 'x'.repeat(101) }, { status: 'TODO' }, { priority: 'INVALID' },
    { overdueOnly: 'true' }, { dueDate: '2026-02-30' }, { completedDate: null },
    { dueDate: '2026-10-27', dueFrom: now }, { dueFrom: now, dueTo: now - 1 },
  ]) await assert.rejects(service.getKanbanBoard({ ...admin, filters }), { statusCode: 400 });
  await assert.rejects(service.getKanbanBoard({ ...admin, sortBy: 'unsafe' }), { code: 'INVALID_TASK_SORT' });
  assert.equal(query.mock.callCount(), 0);
  const failure = new Error('query failed');
  await assert.rejects(new TaskService({ async getKanbanTasks() { throw failure; } }).getKanbanBoard(admin), (error) => error === failure);
  settings(context, 'Invalid/Zone');
  await assert.rejects(service.getKanbanBoard(admin), { code: 'INVALID_TIME_ZONE' });
});

test('Kanban and getTasks accept employee arrays with all requested filters; empty arrays omit employee filtering', async (context) => {
  settings(context);
  const calls = [];
  const service = new TaskService({
    async getKanbanTasks(params) { calls.push(params); return []; },
    async listTasks(params) { calls.push(params); return { rows: [], count: 0 }; },
  });
  const filters = {
    assignedToUserId: [47, '48', 47], status: 'COMPLETED', priority: 'HIGH', search: 'proposal',
    completedDate: '23/10/2026', dueDate: '22/10/2026', overdueOnly: false,
  };
  for (const method of ['getKanbanBoard', 'listTasks']) {
    await service[method]({ ...admin, filters });
    const actual = calls.at(-1).filters;
    assert.deepEqual(actual.assignedToUserId, [47, 48]);
    assert.equal(actual.status, 'COMPLETED');
    assert.equal(actual.priority, 'HIGH');
    assert.equal(actual.search, 'proposal');
    assert.equal(actual.overdueOnly, false);
    assert.equal(actual.dueFrom, Date.parse('2026-10-21T18:30:00Z') / 1000);
    assert.equal(actual.dueTo, Date.parse('2026-10-22T18:29:59Z') / 1000);
    assert.equal(actual.completedFrom, Date.parse('2026-10-22T18:30:00Z') / 1000);
    assert.equal(actual.completedTo, Date.parse('2026-10-23T18:29:59Z') / 1000);
    await service[method]({ ...admin, filters: { assignedToUserId: [] } });
    assert.equal('assignedToUserId' in calls.at(-1).filters, false);
  }
  assert.deepEqual(filters.assignedToUserId, [47, '48', 47]);
});

test('repository uses IN for employee arrays, no restriction for empty arrays and preserves employee scope', async (context) => {
  const options = [];
  context.mock.method(Task, 'findAll', async (params) => { options.push(params); return []; });
  context.mock.method(Task, 'findAndCountAll', async (params) => { options.push(params); return { rows: [], count: 0 }; });
  const repository = new TaskRepository();
  for (const method of ['getKanbanTasks', 'listTasks']) {
    for (const [ids, isAdmin, expected] of [
      [[47, 48], true, { [Op.in]: [47, 48] }],
      [[], true, undefined],
      [[47, 48], false, 9],
    ]) {
      await repository[method]({
        ...admin, isAdmin, filters: { assignedToUserId: ids }, sortBy: 'createdAt',
        sortOrder: 'DESC', now, page: 1, limit: 20,
      });
      const where = method === 'getKanbanTasks' ? options.at(-1).where[Op.and][0] : options.at(-1).where;
      assert.deepEqual(where.assignedToUserId, expected);
      assert.equal(where.hostId, 7);
    }
  }
});

test('Kanban repository reuses list filtering and associations without pagination and excludes cancelled tasks', async (context) => {
  const repository = new TaskRepository();
  const params = {
    ...admin, filters: {
      assignedToUserId: 47, search: ' TASK-23 ', priority: 'HIGH', customerId: 31, visitId: 41,
      createdByUserId: 9, dueFrom: now - 100, dueTo: now + 100,
      completedFrom: now - 10, completedTo: now, overdueOnly: true,
    },
    sortBy: 'createdAt', sortOrder: 'DESC', now,
  };
  let listOptions;
  context.mock.method(Task, 'findAndCountAll', async (options) => { listOptions = options; return { rows: [], count: 0 }; });
  await repository.listTasks({ ...params, page: 2, limit: 20 });
  const find = context.mock.method(Task, 'findAll', async (options) => {
    assert.equal(options.limit, undefined);
    assert.equal(options.offset, undefined);
    assert.deepEqual(options.where[Op.and], [listOptions.where, { status: { [Op.ne]: 'CANCELLED' } }]);
    assert.deepEqual(options.include, listOptions.include);
    assert.deepEqual(options.order, listOptions.order);
    const where = options.where[Op.and][0];
    assert.equal(where.hostId, 7);
    assert.equal(where.isDeleted, 0);
    assert.equal(where.assignedToUserId, 47);
    assert.deepEqual(where[Op.or], [
      { title: { [Op.like]: '%TASK-23%' } }, { taskNumber: { [Op.like]: '%TASK-23%' } },
    ]);
    assert.deepEqual(where.dueAt, { [Op.gte]: now - 100, [Op.lte]: now + 100 });
    for (const include of options.include) assert.deepEqual(include.where, { hostId: 7, isDeleted: 0 });
    return [];
  });
  assert.deepEqual(await repository.getKanbanTasks(params), []);
  assert.equal(find.mock.callCount(), 1);
});

test('Kanban HTTP contract enforces JWT/admin/CSRF and accepts nested or top-level filters', async (context) => {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const jwt = require('jsonwebtoken');
  const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
  const { authMiddleware, requireAdminRole } = require('../../src/shared/middleware/auth.middleware');
  const { requireAdminCsrfToken } = require('../../src/shared/middleware/csrf.middleware');
  const { getAdminCsrfCookieName } = require('../../src/shared/utils/auth-cookie.util');
  const { errorHandler } = require('../../src/shared/middleware/error-handler.middleware');
  const serializer = require('../../src/shared/middleware/response-serializer.middleware').default;
  const routes = require('../../src/routes/v1/admin/tasks.routes').default;
  settings(context);
  context.mock.method(console, 'log', () => {});
  context.mock.method(console, 'error', () => {});
  let user = { id: 9, hostId: 7, isAdminUser: 1 };
  context.mock.method(userRepository, 'findById', async () => user);
  let received;
  const service = new TaskService({ async getKanbanTasks(params) { received = params; return [task(1, 'PENDING')]; } });
  const operation = context.mock.method(taskService, 'getKanbanBoard', service.getKanbanBoard.bind(service));
  const app = express();
  app.use(express.json(), cookieParser(), serializer);
  app.use('/api/v1/admin/tasks', authMiddleware, requireAdminRole, requireAdminCsrfToken, routes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const token = jwt.sign({ userId: 9 }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const send = async (body = { hostId: 7 }, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/tasks/kanban-board`, {
      method: 'POST',
      headers: {
        ...(options.auth === false ? {} : { Authorization: `Bearer ${token}` }),
        ...(options.csrf === false ? {} : { Cookie: `${getAdminCsrfCookieName()}=csrf`, 'x-csrf-token': 'csrf' }),
        'Content-Type': 'application/json',
      },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  };
  const result = await send({ hostId: 7, isAdmin: false, filters: { assignedToUserId: 47, search: 'Title' } });
  assert.equal(result.status, 200);
  assert.deepEqual(Object.keys(result.body), ['status', 'timestamp', 'data']);
  assert.equal(result.body.data.columns[0].tasks[0].title, 'Title 1');
  assert.equal(received.hostId, 7);
  assert.equal(received.isAdmin, true);
  assert.equal(received.filters.assignedToUserId, 47);
  assert.equal(received.filters.search, 'Title');
  await send({ hostId: 7, assignedToUserId: 48, search: 'TASK-2' });
  assert.equal(received.filters.assignedToUserId, 48);
  assert.equal(received.filters.search, 'TASK-2');
  assert.equal((await send()).status, 200);
  assert.equal((await send({ hostId: 7, filters: { search: 5 } })).status, 400);
  const beforeHostValidation = operation.mock.callCount();
  for (const hostId of [undefined, null, '', true, [], [7], {}, 0, -1, 1.5, '7.0', 'invalid', Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = await send({ hostId });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, 'INVALID_HOST_ID');
  }
  const differentHost = await send({ hostId: 999 });
  assert.equal(differentHost.status, 200);
  assert.equal(received.hostId, 7);
  assert.equal(operation.mock.callCount(), beforeHostValidation + 1);
  assert.equal((await send({ hostId: '7' })).status, 200);
  const beforeDenied = operation.mock.callCount();
  assert.equal((await send({}, { auth: false })).status, 401);
  assert.equal((await send({}, { csrf: false })).status, 401);
  user = { ...user, isAdminUser: 0 };
  assert.equal((await send()).status, 403);
  assert.equal(operation.mock.callCount(), beforeDenied);
  user = { ...user, isAdminUser: 1 };
  context.mock.method(taskService, 'getKanbanBoard', async () => { throw new Error('database failure'); });
  const failed = await send();
  assert.equal(failed.status, 500);
  assert.equal(failed.body.success, false);
});
