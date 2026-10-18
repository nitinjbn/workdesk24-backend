import test, { mock } from 'node:test';
import assert from 'node:assert/strict';
import type { Transaction } from 'sequelize';
import type { Response, NextFunction } from 'express';
import { CONFIG } from '../../src/config/constants';
import { sequelize, Task, TaskLogs, TaskSettings } from '../../src/models';
import { TaskRepository } from '../../src/modules/task/repositories/task.repository';
import taskService, { TaskService } from '../../src/modules/task/services/task.service';
import { TaskController } from '../../src/modules/task/controllers/task.controller';
import type { AuthRequest } from '../../src/shared/types/auth.types';

type Settings = {
  hostId: number;
  taskNumberPrefix: string;
  nextTaskNumber: number | string;
  createdAt: number;
  updatedAt: number;
};
type TaskRow = { id: number; hostId: number; taskNumber: string; [key: string]: unknown };
type MemoryTransaction = {
  LOCK: { UPDATE: string };
  hostId?: number;
  settings?: Settings;
  tasks: TaskRow[];
  logs: unknown[];
  release?: () => void;
  committed: boolean;
  rolledBack: boolean;
  commit(): Promise<void>;
  rollback(): Promise<void>;
};

// These fakes exercise the real repository/service/controller with transaction-local
// writes and per-host locking. Actual MySQL locking is covered by the opt-in suite.
function harness() {
  const settings = new Map<number, Settings>();
  const tasks: TaskRow[] = [];
  const logs: unknown[] = [];
  const transactions: MemoryTransaction[] = [];
  const locks = new Map<number, Promise<void>>();
  let nextId = 1;
  let failure: 'insert' | 'task' | 'log' | 'counter' | 'collision' | undefined;
  let notifications = 0;

  mock.method(sequelize, 'query', async (sql: string, options: {
    transaction: MemoryTransaction;
    replacements: { hostId: number; prefix: string; nextTaskNumber: number; now: number };
  }) => {
    assert.match(sql, /INSERT INTO wd_task_settings/);
    assert.match(sql, /ON DUPLICATE KEY UPDATE hostId = wd_task_settings.hostId\s*$/);
    assert.doesNotMatch(sql, /IGNORE/);
    if (failure === 'insert') throw new Error('settings insert failed');
    const { transaction, replacements } = options;
    assert.ok(transactions.includes(transaction));
    const previous = locks.get(replacements.hostId) || Promise.resolve();
    let release!: () => void;
    const held = new Promise<void>((resolve) => { release = resolve; });
    locks.set(replacements.hostId, previous.then(() => held));
    await previous;
    transaction.release = release;
    transaction.hostId = replacements.hostId;
    transaction.settings = { ...(settings.get(replacements.hostId) || {
      hostId: replacements.hostId,
      taskNumberPrefix: replacements.prefix,
      nextTaskNumber: replacements.nextTaskNumber,
      createdAt: replacements.now,
      updatedAt: replacements.now,
    }) };
    return [];
  });

  mock.method(TaskSettings, 'findOne', async (options: {
    where: { hostId: number }; transaction: MemoryTransaction; lock: string;
  }) => {
    const transaction = options.transaction;
    assert.equal(options.where.hostId, transaction.hostId);
    assert.equal(options.lock, transaction.LOCK.UPDATE);
    return {
      ...transaction.settings,
      async update(data: Partial<Settings>, updateOptions: { transaction: MemoryTransaction }) {
        assert.equal(updateOptions.transaction, transaction);
        if (failure === 'counter') throw new Error('counter update failed');
        Object.assign(transaction.settings!, data);
        return this;
      },
    };
  });

  mock.method(Task, 'create', async (data: TaskRow, options: { transaction: MemoryTransaction }) => {
    if (failure === 'task') throw new Error('task insert failed');
    if (failure === 'collision' || [...tasks, ...options.transaction.tasks].some(
      (task) => task.hostId === data.hostId && task.taskNumber === data.taskNumber
    )) throw new Error('duplicate task number');
    const row = { ...data, id: nextId++ };
    options.transaction.tasks.push(row);
    return { ...row, toJSON: () => ({ ...row }) };
  });
  mock.method(TaskLogs, 'create', async (data: unknown, options: { transaction: MemoryTransaction }) => {
    if (failure === 'log') throw new Error('log insert failed');
    options.transaction.logs.push(data);
    return data;
  });

  const repository = new TaskRepository();
  mock.method(repository, 'findAssignee', async (hostId: number, userId: number) => (
    [7, 8].includes(hostId) && userId === 22 ? { id: userId } : null
  ));
  const service = new TaskService(repository, async () => {
    const transaction: MemoryTransaction = {
      LOCK: { UPDATE: 'UPDATE' }, tasks: [], logs: [], committed: false, rolledBack: false,
      async commit() {
        if (this.settings) settings.set(this.hostId!, { ...this.settings });
        tasks.push(...this.tasks);
        logs.push(...this.logs);
        this.committed = true;
        this.release?.();
      },
      async rollback() {
        this.rolledBack = true;
        this.release?.();
      },
    };
    transactions.push(transaction);
    return transaction as unknown as Transaction;
  }, {
    async notifyTaskCreated() {
      assert.ok(transactions.some((transaction) => transaction.committed));
      notifications += 1;
    },
    async notifyTaskReassigned() {},
  });
  return {
    service, settings, tasks, logs, transactions,
    fail(value: typeof failure) { failure = value; },
    get notifications() { return notifications; },
  };
}

const payload = { hostId: 7, userId: 9, isAdmin: true, title: ' Proposal ', assignedToUserId: 22 };
const defaultPrefix = CONFIG.TASK_SETTINGS.DEFAULT_TASK_NUMBER_PREFIX;
const defaultNumber = (counter: number) => `${defaultPrefix}${defaultPrefix.endsWith('-') ? '' : '-'}${counter}`;
const existingSettings = (prefix = 'PRODISSUE', counter: number | string = 41): Settings => ({
  hostId: 7, taskNumberPrefix: prefix, nextTaskNumber: counter, createdAt: 100, updatedAt: 100,
});

test.afterEach(() => mock.restoreAll());

test('first and second tasks persist sequential numbers; each host has its own settings', async () => {
  const h = harness();
  const first = await h.service.createTask(payload);
  const second = await h.service.createTask(payload);
  const other = await h.service.createTask({ ...payload, hostId: 8 });
  assert.equal(first.task.taskNumber, defaultNumber(1));
  assert.equal(second.task.taskNumber, defaultNumber(2));
  assert.equal(other.task.taskNumber, defaultNumber(1));
  assert.equal(h.settings.size, 2);
  assert.equal(h.settings.get(7)!.nextTaskNumber, '3');
  assert.equal(h.settings.get(8)!.nextTaskNumber, '2');
  assert.equal(h.settings.get(7)!.taskNumberPrefix, defaultPrefix);
  assert.deepEqual(h.tasks.map((task) => task.taskNumber), [defaultNumber(1), defaultNumber(2), defaultNumber(1)]);
  assert.equal(first.task.title, 'Proposal');
  assert.equal(first.task.status, 'PENDING');
  assert.equal(first.task.priority, 'LOW');
  assert.equal(first.task.createdByUserId, 9);
  assert.equal(first.task.assignedToUserId, 22);
  assert.equal(h.logs.length, 3);
  assert.equal(h.notifications, 3);
  assert.ok(h.transactions.every((transaction) => transaction.committed));
  assert.equal(h.settings.get(7)!.updatedAt, second.task.updatedAt);
  assert.ok(Number.isInteger(h.settings.get(7)!.updatedAt));
});

test('existing prefix, creation timestamp, and counter are preserved and advanced, not reset', async () => {
  const h = harness();
  h.settings.set(7, existingSettings());
  const result = await h.service.createTask(payload);
  assert.equal(result.task.taskNumber, 'PRODISSUE-41');
  assert.equal(h.settings.get(7)!.taskNumberPrefix, 'PRODISSUE');
  assert.equal(h.settings.get(7)!.createdAt, 100);
  assert.equal(h.settings.get(7)!.nextTaskNumber, '42');
});

test('stored trailing separator is not duplicated', async () => {
  const h = harness();
  h.settings.set(7, existingSettings('CUSTOM-', 3));
  assert.equal((await h.service.createTask(payload)).task.taskNumber, 'CUSTOM-3');
});

for (const initialized of [false, true]) {
  test(`concurrent requests serialize ${initialized ? 'existing' : 'first-time'} host allocation`, async () => {
    const h = harness();
    if (initialized) h.settings.set(7, existingSettings('CUSTOM', 10));
    const results = await Promise.all(Array.from({ length: 12 }, () => h.service.createTask(payload)));
    const expected = Array.from({ length: 12 }, (_, index) => initialized ? `CUSTOM-${index + 10}` : defaultNumber(index + 1));
    assert.deepEqual(results.map((result) => result.task.taskNumber), expected);
    assert.equal(new Set(h.tasks.map((task) => task.taskNumber)).size, 12);
    assert.equal(h.settings.size, 1);
    assert.equal(h.settings.get(7)!.nextTaskNumber, initialized ? '22' : '13');
  });

  for (const failure of ['insert', 'task', 'log', 'counter', 'collision'] as const) {
    test(`${failure} failure rolls back ${initialized ? 'existing' : 'new'} settings and propagates without notification`, async () => {
      const h = harness();
      if (initialized) h.settings.set(7, existingSettings());
      h.fail(failure);
      await assert.rejects(h.service.createTask(payload), /failed|duplicate task number/);
      assert.equal(h.tasks.length, 0);
      assert.equal(h.logs.length, 0);
      assert.equal(h.notifications, 0);
      assert.equal(h.transactions[0].rolledBack, true);
      assert.equal(h.transactions[0].committed, false);
      assert.deepEqual(h.settings.get(7), initialized ? existingSettings() : undefined);
      h.fail(undefined);
      assert.equal((await h.service.createTask(payload)).task.taskNumber, initialized ? 'PRODISSUE-41' : defaultNumber(1));
    });
  }
}

test('BIGINT counters above Number.MAX_SAFE_INTEGER remain exact', async () => {
  const h = harness();
  h.settings.set(7, existingSettings('BIG', '9007199254740993'));
  assert.equal((await h.service.createTask(payload)).task.taskNumber, 'BIG-9007199254740993');
  assert.equal(h.settings.get(7)!.nextTaskNumber, '9007199254740994');
});

for (const counter of [0, -1, 1.5, Number.MAX_SAFE_INTEGER + 1, '1e3', '01', 'NaN', '9223372036854775807', '9223372036854775808']) {
  test(`invalid or overflowing counter ${counter} is explicitly rejected without consuming a number`, async () => {
    const h = harness();
    h.settings.set(7, existingSettings('CUSTOM', counter));
    await assert.rejects(h.service.createTask(payload), /counter/);
    assert.deepEqual(h.settings.get(7), existingSettings('CUSTOM', counter));
    assert.equal(h.tasks.length, 0);
    assert.equal(h.transactions[0].rolledBack, true);
  });
}

for (const prefix of ['', ' ', ' BAD', 'BAD ', 'A'.repeat(21)]) {
  test(`invalid prefix ${JSON.stringify(prefix)} is explicitly rejected`, async () => {
    const h = harness();
    h.settings.set(7, existingSettings(prefix));
    await assert.rejects(h.service.createTask(payload), /prefix/);
    assert.equal(h.tasks.length, 0);
    assert.equal(h.settings.get(7)!.nextTaskNumber, 41);
  });
}

test('30-character boundary succeeds; 31 characters rolls back without truncation', async () => {
  const h = harness();
  h.settings.set(7, existingSettings('A'.repeat(20), '999999999'));
  assert.equal((await h.service.createTask(payload)).task.taskNumber.length, 30);
  assert.equal(h.settings.get(7)!.nextTaskNumber, '1000000000');
  await assert.rejects(h.service.createTask(payload), /exceeds 30 characters/);
  assert.equal(h.settings.get(7)!.nextTaskNumber, '1000000000');
  assert.equal(h.tasks.length, 1);
});

test('controller uses authenticated identity, ignores client taskNumber, and returns the existing API envelope', async () => {
  const h = harness();
  mock.method(taskService, 'createTask', (data: Parameters<TaskService['createTask']>[0]) => h.service.createTask(data));
  let body: { success: boolean; message: string; data: { task: TaskRow } } | undefined;
  const request = {
    body: { ...payload, hostId: 8, userId: 99, isAdmin: false, taskNumber: 'INJECTED-99' },
    user: { hostId: 7, id: 9, isAdminUser: 1 },
  } as unknown as AuthRequest;
  const response = { json(value: typeof body) { body = value; } } as Response;
  const next: NextFunction = (error) => { throw error; };
  await new TaskController().createTask(request, response, next);
  assert.equal(body!.success, true);
  assert.equal(body!.message, 'Task created successfully');
  assert.equal(body!.data.task.taskNumber, defaultNumber(1));
  assert.equal(body!.data.task.hostId, 7);
  assert.equal(body!.data.task.createdByUserId, 9);
  assert.equal(h.settings.has(8), false);
});

test('body-supplied admin privilege cannot authorize task creation', async () => {
  const h = harness();
  mock.method(taskService, 'createTask', (data: Parameters<TaskService['createTask']>[0]) => h.service.createTask(data));
  let error: Error | undefined;
  const next: NextFunction = (value: unknown) => {
    assert.ok(value instanceof Error);
    error = value;
  };
  await new TaskController().createTask({
    body: { ...payload, isAdmin: true }, user: { hostId: 7, id: 9, isAdminUser: 0 },
  } as unknown as AuthRequest, {
    json() { assert.fail('Unauthorized creation must not succeed'); },
  } as unknown as Response, next);
  assert.match(error!.message, /Admin access/);
  assert.equal(h.transactions.length, 0);
});
