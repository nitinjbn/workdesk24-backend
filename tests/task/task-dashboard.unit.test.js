require('ts-node/register/transpile-only');

process.env.JWT_SECRET = 'task-dashboard-test-signing-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const { once } = require('node:events');
const { DatabaseSync } = require('node:sqlite');
const { QueryTypes } = require('sequelize');
const { sequelize } = require('../../src/models');
const { TaskRepository } = require('../../src/modules/task/repositories/task.repository');
const { TaskService } = require('../../src/modules/task/services/task.service');
const taskService = require('../../src/modules/task/services/task.service').default;
const hostSettings = require('../../src/shared/utils/host-settings.util');

const admin = { hostId: 7, isAdmin: true };
const now = Date.parse('2026-10-27T02:26:00Z') / 1000;

function stubSettings(context, timeZone = 'Asia/Kolkata') {
  context.mock.method(hostSettings, 'getHostDateTimeSettings', async (hostId) => {
    assert.equal(hostId, 7);
    return { timeZone };
  });
  context.mock.method(Date, 'now', () => now * 1000);
}

test('dashboard aggregates all users, matches the response shape and rounds percentages', async (context) => {
  stubSettings(context);
  const service = new TaskService({
    async getDashboardStats(hostId, timestamp) {
      assert.equal(hostId, 7);
      assert.equal(timestamp, now);
      return [
        { userId: 47, name: 'Rajesh Sharma', profileImageUrl: 'https://example.com/avatar.png', assignedCount: 12, pendingCount: 2, inProgressCount: 2, completedCount: 7, overdueCount: 1, highCount: 1, mediumCount: 2, lowCount: 2, urgentCount: 1 },
        { userId: 48, name: null, profileImageUrl: null, assignedCount: 36, pendingCount: 6, inProgressCount: 12, completedCount: 14, overdueCount: 4, highCount: 5, mediumCount: 7, lowCount: 5, urgentCount: 3 },
      ];
    },
  });
  assert.deepEqual(await service.getDashboardStats(admin), {
    timestamp: '2026-10-27 07:56 AM',
    summary: {
      totalTasks: 48, pendingTasks: 8, inProgress: 14, completed: 21, overdue: 5,
      completionPercentage: 43.75, pendingPercentage: 16.67, inProgressPercentage: 29.17,
      overduePercentage: 10.42,
    },
    statusDistribution: [
      { status: 'TODO', label: 'Pending', count: 8, percentage: 16.67, color: '#9333ea' },
      { status: 'IN_PROGRESS', label: 'In Progress', count: 14, percentage: 29.17, color: '#ffaa00' },
      { status: 'OVERDUE', label: 'Overdue', count: 5, percentage: 10.42, color: '#c00404' },
    ],
    priorityDistribution: [
      { priority: 'HIGH', label: 'High', count: 6, color: '#c00404' },
      { priority: 'MEDIUM', label: 'Medium', count: 9, color: '#ffaa00' },
      { priority: 'LOW', label: 'Low', count: 7, color: '#0284c7' },
      { priority: 'URGENT', label: 'Urgent', count: 4, color: '#8b0000' },
    ],
    userTasksMetrics: [
      { userId: 47, name: 'Rajesh Sharma', profileImageUrl: 'https://example.com/avatar.png', assignedCount: 12, completedCount: 7, overdueCount: 1, efficiencyRate: 58.3 },
      { userId: 48, name: null, profileImageUrl: null, assignedCount: 36, completedCount: 14, overdueCount: 4, efficiencyRate: 38.9 },
    ],
  });
});

test('empty dashboard returns zero counts and percentages in the host timezone', async (context) => {
  stubSettings(context, 'America/New_York');
  const result = await new TaskService({ async getDashboardStats() { return []; } }).getDashboardStats(admin);
  assert.equal(result.timestamp, '2026-10-26 10:26 PM');
  assert.deepEqual(result.summary, {
    totalTasks: 0, pendingTasks: 0, inProgress: 0, completed: 0, overdue: 0,
    completionPercentage: 0, pendingPercentage: 0, inProgressPercentage: 0, overduePercentage: 0,
  });
  assert.deepEqual(result.userTasksMetrics, []);
  assert.deepEqual(result.statusDistribution.map((item) => item.status), ['TODO', 'IN_PROGRESS', 'OVERDUE']);
  assert.deepEqual(result.statusDistribution.map((item) => item.count), [0, 0, 0]);
  assert.deepEqual(result.priorityDistribution.map((item) => item.priority), ['HIGH', 'MEDIUM', 'LOW', 'URGENT']);
  assert.deepEqual(result.priorityDistribution.map((item) => item.count), [0, 0, 0, 0]);
});

test('dashboard rejects non-admins before queries and propagates database/configuration errors', async (context) => {
  stubSettings(context);
  const failure = new Error('database unavailable');
  const query = context.mock.fn(async () => { throw failure; });
  const service = new TaskService({ getDashboardStats: query });
  await assert.rejects(service.getDashboardStats({ ...admin, isAdmin: false }), { code: 'TASK_ADMIN_REQUIRED', statusCode: 403 });
  assert.equal(query.mock.callCount(), 0);
  await assert.rejects(service.getDashboardStats(admin), (error) => error === failure);
  context.mock.method(hostSettings, 'getHostDateTimeSettings', async () => ({ timeZone: 'Invalid/Zone' }));
  await assert.rejects(new TaskService({ async getDashboardStats() { return []; } }).getDashboardStats(admin), {
    code: 'INVALID_TIME_ZONE', statusCode: 500,
  });
});

test('repository SQL uses exclusive buckets, host isolation and deleted/cancelled exclusions', async (context) => {
  const database = new DatabaseSync(':memory:');
  context.after(() => database.close());
  database.exec(`
    CREATE TABLE wd_tasks (hostId INTEGER, assignedToUserId INTEGER, status TEXT, dueAt INTEGER, isDeleted INTEGER, priority TEXT);
    CREATE TABLE wd_users (id INTEGER, hostId INTEGER, name TEXT, profileImageUrl TEXT, isDeleted INTEGER);
    INSERT INTO wd_users VALUES (47, 7, 'Rajesh', 'avatar.png', 0), (48, 7, 'Deleted profile', 'deleted.png', 1),
                               (49, 7, 'No tasks', NULL, 0), (47, 8, 'Other tenant', 'other.png', 0);
  `);
  const insert = database.prepare('INSERT INTO wd_tasks VALUES (?, ?, ?, ?, ?, ?)');
  for (const row of [
    [7, 47, 'PENDING', null, 0, 'HIGH'],
    [7, 47, 'IN_PROGRESS', now, 0, 'MEDIUM'],
    [7, 47, 'PENDING', now - 1, 0, 'LOW'],
    [7, 47, 'IN_PROGRESS', now - 1, 0, 'URGENT'],
    [7, 47, 'COMPLETED', now - 1, 0, 'HIGH'],
    [7, 47, 'CANCELLED', now - 1, 0, 'URGENT'],
    [7, 47, 'COMPLETED', now - 1, 1, 'LOW'],
    [7, 48, 'COMPLETED', null, 0, 'MEDIUM'],
    [7, 50, 'PENDING', now + 1, 0, 'LOW'],
    [8, 47, 'COMPLETED', now - 1, 0, 'URGENT'],
    [9, 47, 'CANCELLED', null, 0, 'HIGH'],
  ]) insert.run(...row);

  // Execute the repository's actual aggregate SQL without touching a configured database.
  const query = context.mock.method(sequelize, 'query', async (sql, options) => {
    assert.equal(options.type, QueryTypes.SELECT);
    assert.equal(options.replacements.now, now);
    return database.prepare(sql).all(options.replacements).map((row) => ({
      ...row,
      userId: String(row.userId),
      ...Object.fromEntries(['assignedCount', 'pendingCount', 'inProgressCount', 'completedCount', 'overdueCount', 'highCount', 'mediumCount', 'lowCount', 'urgentCount']
        .map((key) => [key, String(row[key])])),
    }));
  });
  const repository = new TaskRepository();
  assert.deepEqual(await repository.getDashboardStats(7, now), [
    { userId: 47, name: 'Rajesh', profileImageUrl: 'avatar.png', assignedCount: 5, pendingCount: 1, inProgressCount: 1, completedCount: 1, overdueCount: 2, highCount: 1, mediumCount: 1, lowCount: 1, urgentCount: 1 },
    { userId: 48, name: null, profileImageUrl: null, assignedCount: 1, pendingCount: 0, inProgressCount: 0, completedCount: 1, overdueCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, urgentCount: 0 },
    { userId: 50, name: null, profileImageUrl: null, assignedCount: 1, pendingCount: 1, inProgressCount: 0, completedCount: 0, overdueCount: 0, highCount: 0, mediumCount: 0, lowCount: 1, urgentCount: 0 },
  ]);
  assert.equal(query.mock.callCount(), 1);
  assert.deepEqual(await repository.getDashboardStats(8, now), [
    { userId: 47, name: 'Other tenant', profileImageUrl: 'other.png', assignedCount: 1, pendingCount: 0, inProgressCount: 0, completedCount: 1, overdueCount: 0, highCount: 0, mediumCount: 0, lowCount: 0, urgentCount: 0 },
  ]);
  assert.deepEqual(await repository.getDashboardStats(9, now), []);
  assert.deepEqual(await repository.getDashboardStats(10, now), []);
});

test('POST dashboard-stats preserves the envelope and enforces authentication, admin role and CSRF', async (context) => {
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
  stubSettings(context);
  context.mock.method(console, 'log', () => {});
  context.mock.method(console, 'error', () => {});
  let user = { id: 9, hostId: 7, isAdminUser: 1 };
  context.mock.method(userRepository, 'findById', async () => user);
  const service = new TaskService({ async getDashboardStats() { return []; } });
  const operation = context.mock.method(taskService, 'getDashboardStats', async (payload) => {
    assert.deepEqual(payload, { hostId: 7, userId: 9, isAdmin: true });
    return service.getDashboardStats(payload);
  });
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
  const send = async (options = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/tasks/dashboard-stats`, {
      method: options.method || 'POST',
      headers: {
        ...(options.auth === false ? {} : { Authorization: `Bearer ${token}` }),
        ...(options.csrf === false ? {} : {
          Cookie: `${getAdminCsrfCookieName()}=test-csrf`, 'x-csrf-token': options.csrfToken || 'test-csrf',
        }),
        'Content-Type': 'application/json',
      },
      ...(options.method === 'GET' ? {} : { body: JSON.stringify(options.body ?? { hostId: 7, isAdmin: false, userId: 999 }) }),
    });
    return { status: response.status, body: response.status === 404 ? null : await response.json() };
  };
  const result = await send();
  assert.equal(result.status, 200);
  assert.deepEqual(result.body, {
    success: true,
    message: 'Dashboard stats retrieved successfully',
    data: await service.getDashboardStats(admin),
  });
  assert.deepEqual(Object.keys(result.body), ['success', 'message', 'data']);
  assert.equal(result.body.data.summary.pendingTasks, 0);
  assert.equal(result.body.data.summary.overduePercentage, 0);
  for (const hostId of [undefined, null, '', true, [], [7], {}, 0, -1, 1.5, '7.0', 'invalid', Number.MAX_SAFE_INTEGER + 1]) {
    const invalid = await send({ body: { hostId } });
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.code, 'INVALID_HOST_ID');
  }
  const differentHost = await send({ body: { hostId: 999 } });
  assert.equal(differentHost.status, 200);
  assert.deepEqual(differentHost.body, result.body);
  assert.equal(operation.mock.callCount(), 2);
  assert.equal((await send({ body: { hostId: '7' } })).status, 200);
  assert.equal((await send({ auth: false })).status, 401);
  assert.equal((await send({ csrf: false })).status, 401);
  assert.equal((await send({ csrfToken: 'wrong-token' })).status, 401);
  user = { ...user, isAdminUser: 0 };
  assert.equal((await send()).status, 403);
  assert.equal(operation.mock.callCount(), 3);
  user = { ...user, isAdminUser: 1 };
  assert.equal((await send({ method: 'GET' })).status, 404);
  context.mock.method(taskService, 'getDashboardStats', async () => { throw new Error('database failure'); });
  const failed = await send();
  assert.equal(failed.status, 500);
  assert.equal(failed.body.success, false);
  assert.equal(failed.body.message, 'database failure');
});
