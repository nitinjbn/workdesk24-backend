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

  const { sequelize, Task, TaskLogs, TaskSettings } = await import('../../src/models');
  const { TaskService } = await import('../../src/modules/task/services/task.service');
  const { TaskRepository } = await import('../../src/modules/task/repositories/task.repository');
  const { CONFIG } = await import('../../src/config/constants');
  const repository = new TaskRepository();
  const service = new TaskService(repository, () => sequelize.transaction(), {
    async notifyTaskCreated() {},
    async notifyTaskReassigned() {},
  });
  const ownedTaskIds: number[] = [];
  const ownedHostIds: number[] = [];
  async function create(host = hosts[0]) {
    const result = await service.createTask(host);
    ownedTaskIds.push(result.task.id);
    return result.task;
  }
  async function settings() {
    return TaskSettings.findOne({ where: { hostId: hosts[0].hostId } });
  }
  try {
    await sequelize.authenticate();
    for (const host of hosts) {
      assert.equal(await TaskSettings.count({ where: { hostId: host.hostId } }), 0, 'Fixture hosts must not have settings');
      assert.equal(await Task.count({ where: { hostId: host.hostId } }), 0, 'Fixture hosts must not have tasks');
    }
    ownedHostIds.push(...hosts.map((host) => host.hostId));
    const prefix = CONFIG.TASK_SETTINGS.DEFAULT_TASK_NUMBER_PREFIX;
    const expected = (number: number) => `${prefix}${prefix.endsWith('-') ? '' : '-'}${number}`;

    await t.test('concurrent first-time requests create one settings row and persist distinct numbers', async () => {
      const outcomes = await Promise.allSettled(Array.from({ length: 8 }, () => create()));
      for (const outcome of outcomes) assert.equal(outcome.status, 'fulfilled', outcome.status === 'rejected' ? String(outcome.reason) : '');
      const rows = await Task.findAll({ where: { hostId: hosts[0].hostId }, order: [['id', 'ASC']] });
      assert.deepEqual(rows.map((row) => row.taskNumber).sort(), Array.from({ length: 8 }, (_, index) => expected(index + 1)).sort());
      assert.equal(await TaskSettings.count({ where: { hostId: hosts[0].hostId } }), 1);
      assert.equal(String((await settings())!.nextTaskNumber), '9');
    });

    await t.test('another host starts at one', async () => {
      const task = await create(hosts[1]);
      assert.equal(task.taskNumber, expected(1));
      assert.equal((await Task.findByPk(task.id))!.taskNumber, expected(1));
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
      await assert.rejects(create(), { name: 'SequelizeUniqueConstraintError' });
      assert.equal(String((await settings())!.nextTaskNumber), '47');
    });
  } finally {
    try {
      if (ownedTaskIds.length) {
        await TaskLogs.destroy({ where: { taskId: ownedTaskIds, hostId: ownedHostIds } });
        await Task.destroy({ where: { id: ownedTaskIds, hostId: ownedHostIds } });
      }
      if (ownedHostIds.length) await TaskSettings.destroy({ where: { hostId: ownedHostIds } });
    } finally {
      await sequelize.close();
    }
  }
});
