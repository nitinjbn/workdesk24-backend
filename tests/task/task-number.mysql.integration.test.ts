import test, { mock } from 'node:test';
import assert from 'node:assert/strict';

// Opt in only with a disposable, already-migrated MySQL test database and two
// dedicated existing hosts, each with an active field-app assignee and an admin.
// No schema changes are made. Successful fixture writes are cleaned up by ID.
test('MySQL task-number persistence, rollback, and concurrent allocation', {
  skip: !process.env.TASK_NUMBER_TEST_DB_NAME
    ? 'Requires explicit TASK_NUMBER_TEST_DB_* connection settings and dedicated host/user fixtures'
    : false,
}, async (t) => {
  function required(name: string): string {
    const value = process.env[`TASK_NUMBER_TEST_${name}`];
    assert.ok(value, `TASK_NUMBER_TEST_${name} is required`);
    return value;
  }
  const database = required('DB_NAME');
  assert.match(database, /(?:^|_)test(?:_|$)/i, 'Use a disposable database with "test" in its name');
  process.env.NODE_ENV = 'test';
  process.env.DB_NAME = database;
  process.env.DB_NAME_TEST = database;
  process.env.DB_HOST = required('DB_HOST');
  process.env.DB_PORT = required('DB_PORT');
  process.env.DB_USER = required('DB_USER');
  process.env.DB_PASSWORD = required('DB_PASSWORD');
  const hosts = [1, 2].map((index) => ({
    hostId: Number(required(`HOST_${index}_ID`)),
    userId: Number(required(`HOST_${index}_ADMIN_ID`)),
    assignedToUserId: Number(required(`HOST_${index}_ASSIGNEE_ID`)),
    isAdmin: true,
    title: 'Task number integration fixture',
  }));
  for (const host of hosts) {
    for (const id of [host.hostId, host.userId, host.assignedToUserId]) assert.ok(Number.isSafeInteger(id) && id > 0);
  }
  assert.notEqual(hosts[0].hostId, hosts[1].hostId);

  const { sequelize, Task, TaskLogs, TaskCategory } = await import('../../src/models');
  const { TaskService } = await import('../../src/modules/task/services/task.service');
  const { TaskRepository } = await import('../../src/modules/task/repositories/task.repository');
  const { TaskCategoryService } = await import('../../src/modules/task/services/task-category.service');
  const { CONFIG } = await import('../../src/config/constants');
  const repository = new TaskRepository();
  const service = new TaskService(repository, () => sequelize.transaction(), {
    async notifyTaskCreated() {},
    async notifyTaskReassigned() {},
  });
  const ownedTaskIds: number[] = [];
  const ownedHostIds: number[] = [];
  const categories = new Map<number, number>();
  const ownedCategoryIds: number[] = [];
  async function create(host = hosts[0], categoryId = categories.get(host.hostId)!) {
    const result = await service.createTask({ ...host, taskCategoryId: categoryId });
    ownedTaskIds.push(result.task.id);
    return result.task;
  }
  async function settings() {
    return TaskCategory.findOne({ where: { hostId: hosts[0].hostId, id: categories.get(hosts[0].hostId) } });
  }
  try {
    await sequelize.authenticate();
    for (const host of hosts) {
      assert.equal(await TaskCategory.count({ where: { hostId: host.hostId } }), 0, 'Fixture hosts must not have categories');
      assert.equal(await Task.count({ where: { hostId: host.hostId } }), 0, 'Fixture hosts must not have tasks');
      const category = await TaskCategory.create({
        hostId: host.hostId, name: 'General', taskNumberPrefix: 'TASK-', createdAt: Math.floor(Date.now() / 1000),
      });
      categories.set(host.hostId, category.id);
      ownedCategoryIds.push(category.id);
    }
    ownedHostIds.push(...hosts.map((host) => host.hostId));
    const prefix = CONFIG.TASK_SETTINGS.DEFAULT_TASK_NUMBER_PREFIX;
    const expected = (number: number) => `${prefix}${prefix.endsWith('-') ? '' : '-'}${number}`;

    await t.test('concurrent requests lock one category and persist distinct numbers', async () => {
      const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => create()));
      for (const outcome of outcomes) assert.equal(outcome.status, 'fulfilled', outcome.status === 'rejected' ? String(outcome.reason) : '');
      const rows = await Task.findAll({ where: { hostId: hosts[0].hostId }, order: [['id', 'ASC']] });
      assert.deepEqual(rows.map((row) => row.taskNumber).sort(), Array.from({ length: 8 }, (_, index) => expected(index + 1)).sort());
      assert.equal(await TaskCategory.count({ where: { hostId: hosts[0].hostId } }), 1);
      assert.equal(String((await settings())!.nextTaskNumber), '9');
    });

    await t.test('another host starts at one', async () => {
      const task = await create(hosts[1]);
      assert.equal(task.taskNumber, expected(1));
      assert.equal((await Task.findByPk(task.id))!.taskNumber, expected(1));
    });

    await t.test('category CRUD enforces database uniqueness, ownership, status and deletion rules', async () => {
      const categoryService = new TaskCategoryService();
      const scope = { hostId: hosts[0].hostId, isAdmin: true };
      const project = await categoryService.create({ ...scope, name: 'Projects', taskNumberPrefix: 'PRJ' });
      ownedCategoryIds.push(project.category.id);
      const categoryId = project.category.id;
      await assert.rejects(categoryService.create({ ...scope, name: 'Projects', taskNumberPrefix: 'OTHER' }), {
        code: 'TASK_CATEGORY_NAME_EXISTS', statusCode: 409,
      });
      await assert.rejects(categoryService.create({ ...scope, name: 'Other', taskNumberPrefix: 'PRJ-' }), {
        code: 'TASK_CATEGORY_PREFIX_EXISTS', statusCode: 409,
      });
      const first = await create(hosts[0], categoryId);
      assert.equal(first.taskNumber, 'PRJ-1');
      assert.equal(String((await settings())!.nextTaskNumber), '9', 'Another category must not consume the General sequence');
      const listed = await categoryService.list({ ...scope, search: 'Projects', isEnabled: 1 });
      assert.equal(Object.hasOwn(listed, 'pagination'), false);
      assert.equal(listed.categories.length, 1);
      assert.equal(listed.categories[0].taskCount, 1);
      const results = await Promise.all([
        ...Array.from({ length: 8 }, () => create(hosts[0], categoryId)),
        categoryService.update({ ...scope, taskCategoryId: categoryId, taskNumberPrefix: 'NEWPRJ' }),
      ]);
      const allocated = results.slice(0, 8).map((result) => result.taskNumber);
      assert.deepEqual(allocated.map((number) => Number(number.split('-').pop())).sort((a, b) => a - b), [2, 3, 4, 5, 6, 7, 8, 9]);
      assert.equal(new Set(allocated).size, 8);
      assert.equal((await create(hosts[0], categoryId)).taskNumber, 'NEWPRJ-10');
      assert.equal((await Task.findByPk(first.id))!.taskNumber, 'PRJ-1');
      await categoryService.toggleStatus({ ...scope, taskCategoryId: categoryId, isEnabled: 0 });
      await assert.rejects(create(hosts[0], categoryId), { code: 'TASK_CATEGORY_DISABLED' });
      const taskList = await repository.listTasks({
        ...scope, userId: hosts[0].userId, filters: { taskCategoryId: categoryId },
        sortBy: 'createdAt', sortOrder: 'ASC', overdueCutoff: Math.floor(Date.now() / 1000),
        page: 1, limit: 20,
      });
      assert.equal(taskList.count, 10);
      assert.equal(taskList.rows[0].taskCategory.name, 'Projects');
      assert.equal(taskList.rows[0].taskCategory.taskNumberPrefix, 'NEWPRJ');
      const detail = await categoryService.detail({ ...scope, taskCategoryId: categoryId });
      assert.equal(detail.category.taskCount, 10);
      assert.equal(String(detail.category.nextTaskNumber), '11');
      await assert.rejects(categoryService.detail({ ...scope, hostId: hosts[1].hostId, taskCategoryId: categoryId }), { statusCode: 404 });
      await assert.rejects(create(hosts[1], categoryId), { code: 'TASK_CATEGORY_NOT_FOUND' });
      await assert.rejects(categoryService.remove({ ...scope, taskCategoryId: categoryId }), { code: 'TASK_CATEGORY_IN_USE' });
      const unused = await categoryService.create({ ...scope, name: 'Unused', taskNumberPrefix: 'UNUSED' });
      ownedCategoryIds.push(unused.category.id);
      await categoryService.remove({ ...scope, taskCategoryId: unused.category.id });
      assert.equal((await TaskCategory.findByPk(unused.category.id))!.isDeleted, 1);
      await assert.rejects(categoryService.toggleStatus({ ...scope, taskCategoryId: unused.category.id, isEnabled: 1 }), { statusCode: 404 });
    });

    await t.test('existing stored prefix and counter serialize concurrent allocations', async () => {
      await (await settings())!.update({ taskNumberPrefix: 'PRODISSUE', nextTaskNumber: '41' });
      const outcomes = await Promise.allSettled(Array.from({ length: 6 }, () => create()));
      for (const outcome of outcomes) assert.equal(outcome.status, 'fulfilled', outcome.status === 'rejected' ? String(outcome.reason) : '');
      const numbers = outcomes.flatMap((outcome) => outcome.status === 'fulfilled' ? [outcome.value.taskNumber] : []);
      assert.deepEqual(numbers.sort(), ['PRODISSUE-41', 'PRODISSUE-42', 'PRODISSUE-43', 'PRODISSUE-44', 'PRODISSUE-45', 'PRODISSUE-46']);
      assert.equal(String((await settings())!.nextTaskNumber), '47');
    });

    await t.test('failure after task, log, and counter writes rolls all of them back', async () => {
      const beforeTasks = await Task.count({ where: { hostId: hosts[0].hostId } });
      const beforeLogs = await TaskLogs.count({ where: { hostId: hosts[0].hostId } });
      const advance = repository.advanceTaskNumber.bind(repository);
      const failure = mock.method(repository, 'advanceTaskNumber', async (...args: Parameters<typeof advance>) => {
        await advance(...args);
        throw new Error('forced failure after sequence update');
      });
      try {
        await assert.rejects(create(), /forced failure/);
      } finally {
        failure.mock.restore();
      }
      assert.equal(await Task.count({ where: { hostId: hosts[0].hostId } }), beforeTasks);
      assert.equal(await TaskLogs.count({ where: { hostId: hosts[0].hostId } }), beforeLogs);
      assert.equal(String((await settings())!.nextTaskNumber), '47');
      assert.equal((await create()).taskNumber, 'PRODISSUE-47');
    });

    await t.test('actual unique task-number collision is surfaced and leaves the counter unchanged', async () => {
      const row = (await settings())!;
      await row.update({ nextTaskNumber: '47' });
      await assert.rejects(create(), { code: 'TASK_NUMBER_CONFLICT', statusCode: 409 });
      assert.equal(String((await settings())!.nextTaskNumber), '47');
    });
  } finally {
    try {
      if (ownedTaskIds.length) {
        await TaskLogs.destroy({ where: { taskId: ownedTaskIds, hostId: ownedHostIds } });
        await Task.destroy({ where: { id: ownedTaskIds, hostId: ownedHostIds } });
      }
      if (ownedCategoryIds.length) await TaskCategory.destroy({ where: { id: ownedCategoryIds } });
    } finally {
      await sequelize.close();
    }
  }
});
