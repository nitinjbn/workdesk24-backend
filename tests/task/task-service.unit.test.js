require('ts-node/register/transpile-only');

process.env.CLOUDINARY_CLOUD_NAME = 'task-download-test';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.JWT_SECRET = 'task-download-test-signing-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TaskService } = require('../../src/modules/task/services/task.service');
const mediaStorage = require('../../src/shared/utils/media-storage.util');
const cloudinary = require('../../src/config/cloudinary').default;
const { getTaskTransition, isValidTaskFile, isValidUnixTimestamp } = require('../../src/modules/task/services/task-rules.util');
const { DateTimeFormatUtil } = require('../../src/shared/utils/date-time-format.util');
const hostSettingsUtil = require('../../src/shared/utils/host-settings.util');
const { TaskRepository } = require('../../src/modules/task/repositories/task.repository');
const { Task } = require('../../src/models');
const { Op } = require('sequelize');

function stubTaskDateSettings(context, timeZone = 'Asia/Kolkata') {
  return context.mock.method(hostSettingsUtil, 'getHostDateTimeSettings', async (hostId) => {
    assert.equal(hostId, 7);
    return { timeZone, dateTimeFormat: 'YYYY-MM-DD HH:mm:ss', dateFormat: 'YYYY-MM-DD', timeFormat: 'HH:mm:ss' };
  });
}

test('Unix day range uses local calendar boundaries including daylight saving changes', () => {
  for (const [date, timeZone, start, end, hours] of [
    ['2026-10-23', 'Asia/Kolkata', '2026-10-22T18:30:00Z', '2026-10-23T18:29:59Z', 24],
    ['2026-03-08', 'America/New_York', '2026-03-08T05:00:00Z', '2026-03-09T03:59:59Z', 23],
    ['2026-11-01', 'America/New_York', '2026-11-01T04:00:00Z', '2026-11-02T04:59:59Z', 25],
    ['2026-10-23', 'UTC', '2026-10-23T00:00:00Z', '2026-10-23T23:59:59Z', 24],
    ['23/10/2026', 'Asia/Kolkata', '2026-10-22T18:30:00Z', '2026-10-23T18:29:59Z', 24],
    ['08/03/2026', 'America/New_York', '2026-03-08T05:00:00Z', '2026-03-09T03:59:59Z', 23],
    ['01/11/2026', 'America/New_York', '2026-11-01T04:00:00Z', '2026-11-02T04:59:59Z', 25],
  ]) {
    const range = DateTimeFormatUtil.getUnixDayRange(date, timeZone);
    assert.deepEqual(range, { fromDate: Date.parse(start) / 1000, tillDate: Date.parse(end) / 1000 });
    assert.equal(range.tillDate - range.fromDate + 1, hours * 3600);
  }
});

test('Unix day range rejects malformed dates, invalid dates and invalid timezones', () => {
  for (const date of [null, 1791853200, '', '2026-2-03', '23-10-2026', '2026-02-30', '2026-10-23T00:00:00Z', '30/02/2026', '10/23/2026', '3/02/2026', '23/10/26', {}, []]) {
    assert.throws(() => DateTimeFormatUtil.getUnixDayRange(date, 'Asia/Kolkata'), { code: 'INVALID_DATE_FILTER', statusCode: 400 });
  }
  assert.throws(() => DateTimeFormatUtil.getUnixDayRange('2026-10-23', 'Invalid/Zone'), { code: 'INVALID_TIME_ZONE', statusCode: 400 });
  assert.throws(() => DateTimeFormatUtil.getUnixDayRange('2011-12-30', 'Pacific/Apia'), { code: 'INVALID_DATE_FILTER', statusCode: 400 });
  assert.throws(() => DateTimeFormatUtil.getUnixDayRange('30/12/2011', 'Pacific/Apia'), { code: 'INVALID_DATE_FILTER', statusCode: 400 });
  assert.equal(DateTimeFormatUtil.getUnixDayRange('2024-02-29', 'UTC').tillDate, Date.parse('2024-02-29T23:59:59Z') / 1000);
  assert.deepEqual(DateTimeFormatUtil.getUnixDayRange('29/02/2024', 'UTC'), DateTimeFormatUtil.getUnixDayRange('2024-02-29', 'UTC'));
});

class FakeTaskRepository {
  constructor() {
    this.task = null;
    this.logs = [];
    this.comments = [];
    this.listParams = null;
    this.failLog = false;
  }

  async getTask(hostId, taskId) {
    return this.task && this.task.hostId === hostId && this.task.id === taskId && this.task.isDeleted === 0
      ? this.task
      : null;
  }

  async findAssignee(hostId, userId) {
    return hostId === 7 && userId === 22 ? { id: userId } : null;
  }

  async findCustomer(hostId, customerId) {
    return hostId === 7 && [31, 32].includes(customerId) ? { id: customerId } : null;
  }

  async findVisit(hostId, visitId) {
    return hostId === 7 && visitId === 41 ? { id: visitId, customerId: 31 } : null;
  }

  async createTask(data) {
    this.task = { id: 101, ...data };
    return this.task;
  }

  async lockTaskSettings() {
    return { taskNumberPrefix: 'TASK-', nextTaskNumber: 1 };
  }

  async advanceTaskNumber() {}

  async updateTask(task, data) {
    Object.assign(task, data);
    return task;
  }

  async createLog(data) {
    if (this.failLog) throw new Error('log insert failed');
    this.logs.push(data);
    return data;
  }

  async listTasks(params) {
    this.listParams = params;
    return { rows: [], count: 0 };
  }

  async getComments() { return { rows: this.comments, count: this.comments.length }; }
  async getAttachments() { return { rows: [], count: 0 }; }
  async getLogs() { return { rows: this.logs, count: this.logs.length }; }
  async findComment(hostId, taskId, commentId) {
    return this.comments.find((item) => item.hostId === hostId && item.taskId === taskId && item.id === commentId) || null;
  }
  async createComment(data) {
    const item = { id: this.comments.length + 1, ...data };
    this.comments.push(item);
    return item;
  }
}

function makeHarness(taskNotifications) {
  const repository = new FakeTaskRepository();
  const transaction = { committed: false, rolledBack: false, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
  const notifications = taskNotifications || {
    async notifyTaskCreated() {},
    async notifyTaskReassigned() {},
  };
  const service = new TaskService(repository, async () => transaction, notifications);
  return { service, repository, transaction, notifications };
}

const admin = { hostId: 7, userId: 9, isAdmin: true };

test('combined task comment links the attachment to the new comment in one transaction', async (context) => {
  const { service, repository, transaction } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, isDeleted: 0 };
  const createComment = repository.createComment.bind(repository);
  repository.createComment = async (data, commentTransaction) => {
    assert.equal(commentTransaction, transaction);
    assert.equal(transaction.committed, false);
    return createComment(data);
  };
  repository.createAttachment = async (data, attachmentTransaction) => {
    assert.equal(attachmentTransaction, transaction);
    assert.equal(transaction.committed, false);
    return { id: 123, ...data };
  };
  context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async (file, folder, options) => {
    assert.equal(folder, '7/tasks');
    assert.deepEqual(options, { accessMode: 'authenticated' });
    return { url: 'https://example.com/proof.pdf', fileId: 'proof', raw: {} };
  });
  const result = await service.addTaskCommentWithAttachment({
    hostId: 7, taskId: 101, userId: 22, isAdmin: false,
    comment: ' Progress update ', remarks: ' Evidence ', taskCommentId: 888,
    file: { buffer: Buffer.from('%PDF-1.7'), size: 8, mimetype: 'application/pdf', originalname: 'proof.pdf' },
  });
  assert.equal(result.comment.comment, 'Progress update');
  assert.equal(result.comment.userId, 22);
  assert.equal(result.attachment.taskCommentId, result.comment.id);
  assert.equal(result.attachment.taskId, 101);
  assert.equal(result.attachment.hostId, 7);
  assert.equal(result.attachment.uploadedByUserId, 22);
  assert.equal(result.attachment.remarks, 'Evidence');
  assert.equal(transaction.committed, true);
});

test('combined task comment validates comment, access and file before writes or upload', async (context) => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, isDeleted: 0 };
  const upload = context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async () => {
    throw new Error('must not upload');
  });
  const payload = {
    ...admin, taskId: 101, comment: 'Update',
    file: { buffer: Buffer.from('%PDF-1.7'), size: 8, mimetype: 'application/pdf', originalname: 'proof.pdf' },
  };
  for (const [changes, message] of [
    [{ comment: '  ' }, /comment must contain/],
    [{ comment: 'x'.repeat(5001) }, /comment must contain/],
    [{ comment: 42 }, /comment must contain/],
    [{ taskId: 0 }, /valid taskId/],
    [{ hostId: 8 }, /Task not found/],
    [{ isAdmin: false }, /Task not found/],
    [{ file: undefined }, /file upload is required/],
    [{ file: { ...payload.file, size: 10 * 1024 * 1024 + 1 } }, /1 byte to 10 MB/],
    [{ file: { ...payload.file, mimetype: 'image/png' } }, /Only valid/],
    [{ file: { ...payload.file, originalname: 'proof.png' } }, /extension does not match/],
    [{ remarks: 42 }, /remarks must be a string/],
    [{ remarks: 'x'.repeat(501) }, /remarks must not exceed/],
  ]) {
    await assert.rejects(service.addTaskCommentWithAttachment({ ...payload, ...changes }), message);
  }
  assert.equal(upload.mock.callCount(), 0);
  assert.equal(repository.comments.length, 0);
});

test('combined task comment rolls back and cleans media on upload, insert or commit failure', async (context) => {
  for (const failure of ['upload', 'comment', 'attachment', 'commit']) {
    await context.test(failure, async (context) => {
      const { service, repository, transaction } = makeHarness();
      repository.task = { id: 101, hostId: 7, assignedToUserId: 22, isDeleted: 0 };
      if (failure === 'comment') repository.createComment = async () => { throw new Error('comment failed'); };
      repository.createAttachment = async (data) => {
        if (failure === 'attachment') throw new Error('attachment failed');
        return { id: 123, ...data };
      };
      if (failure === 'commit') transaction.commit = async () => { throw new Error('commit failed'); };
      context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async () => {
        if (failure === 'upload') throw new Error('upload failed');
        return { url: 'https://example.com/proof.pdf', fileId: 'proof', raw: { resource_type: 'raw' } };
      });
      const cleanup = context.mock.method(mediaStorage, 'deleteMediaFromStorage', async () => ({}));
      await assert.rejects(service.addTaskCommentWithAttachment({
        ...admin, taskId: 101, comment: 'Update',
        file: { buffer: Buffer.from('%PDF-1.7'), size: 8, mimetype: 'application/pdf', originalname: 'proof.pdf' },
      }), /failed/);
      assert.equal(transaction.rolledBack, true);
      assert.equal(cleanup.mock.callCount(), failure === 'upload' ? 0 : 1);
      if (failure !== 'upload') {
        assert.deepEqual(cleanup.mock.calls[0].arguments, ['proof', { resourceType: 'raw', accessMode: 'authenticated' }]);
      }
    });
  }
});

test('combined task creation saves task and attachment together and notifies after commit', async (context) => {
  let notificationCount = 0;
  const { service, repository, transaction } = makeHarness({
    async notifyTaskCreated(task) {
      assert.equal(transaction.committed, true);
      assert.equal(task.id, 101);
      notificationCount += 1;
    },
    async notifyTaskReassigned() {},
  });
  repository.createAttachment = async (data, attachmentTransaction) => {
    assert.equal(attachmentTransaction, transaction);
    assert.equal(transaction.committed, false);
    return { id: 123, ...data };
  };
  context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async (file, folder, options) => {
    assert.equal(folder, '7/tasks');
    assert.deepEqual(options, { accessMode: 'authenticated' });
    return { url: 'https://example.com/proof.pdf', fileId: 'proof', raw: {} };
  });
  const result = await service.createTaskWithAttachment({
    ...admin, title: 'Proposal', assignedToUserId: 22, remarks: ' Evidence ',
    taskId: 999, taskCommentId: 888,
    file: { buffer: Buffer.from('%PDF-1.7'), size: 8, mimetype: 'application/pdf', originalname: 'proof.pdf' },
  });
  assert.equal(result.task.id, 101);
  assert.equal(result.attachment.taskId, 101);
  assert.equal(result.attachment.taskCommentId, null);
  assert.equal(result.attachment.hostId, 7);
  assert.equal(result.attachment.uploadedByUserId, 9);
  assert.equal(result.attachment.remarks, 'Evidence');
  assert.equal(result.attachment.fileName, 'proof.pdf');
  assert.equal(repository.logs[0].action, 'CREATED');
  assert.equal(notificationCount, 1);
});

test('combined task creation validates inputs before uploading or creating a task', async (context) => {
  const { service, repository } = makeHarness();
  const upload = context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async () => {
    throw new Error('must not upload');
  });
  const payload = {
    ...admin, title: 'Proposal', assignedToUserId: 22,
    file: { buffer: Buffer.from('%PDF-1.7'), size: 8, mimetype: 'application/pdf', originalname: 'proof.pdf' },
  };
  for (const [changes, message] of [
    [{ file: undefined }, /file upload is required/],
    [{ isAdmin: false }, /Admin access/],
    [{ title: '' }, /title must contain/],
    [{ assignedToUserId: 999 }, /not eligible/],
    [{ customerId: 32, visitId: 41 }, /does not belong/],
    [{ file: { ...payload.file, size: 10 * 1024 * 1024 + 1 } }, /1 byte to 10 MB/],
    [{ file: { ...payload.file, mimetype: 'image/png' } }, /Only valid/],
    [{ file: { ...payload.file, originalname: 'proof.png' } }, /extension does not match/],
    [{ remarks: 42 }, /remarks must be a string/],
  ]) {
    await assert.rejects(service.createTaskWithAttachment({ ...payload, ...changes }), message);
  }
  assert.equal(upload.mock.callCount(), 0);
  assert.equal(repository.task, null);
});

test('combined task creation rolls back and cleans uploaded media on persistence or commit failure', async (context) => {
  for (const failure of ['upload', 'log', 'attachment', 'commit']) {
    await context.test(failure, async (context) => {
      let notificationCount = 0;
      const { service, repository, transaction } = makeHarness({
        async notifyTaskCreated() { notificationCount += 1; },
        async notifyTaskReassigned() {},
      });
      repository.failLog = failure === 'log';
      repository.createAttachment = async (data) => {
        if (failure === 'attachment') throw new Error('attachment failed');
        return { id: 123, ...data };
      };
      if (failure === 'commit') transaction.commit = async () => { throw new Error('commit failed'); };
      context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async () => {
        if (failure === 'upload') throw new Error('upload failed');
        return { url: 'https://example.com/proof.pdf', fileId: 'proof', raw: { resource_type: 'raw' } };
      });
      const cleanup = context.mock.method(mediaStorage, 'deleteMediaFromStorage', async () => ({}));
      await assert.rejects(service.createTaskWithAttachment({
        ...admin, title: 'Proposal', assignedToUserId: 22,
        file: { buffer: Buffer.from('%PDF-1.7'), size: 8, mimetype: 'application/pdf', originalname: 'proof.pdf' },
      }), /failed/);
      assert.equal(transaction.rolledBack, true);
      assert.equal(notificationCount, 0);
      assert.equal(cleanup.mock.callCount(), failure === 'upload' ? 0 : 1);
      if (failure !== 'upload') {
        assert.deepEqual(cleanup.mock.calls[0].arguments, ['proof', { resourceType: 'raw', accessMode: 'authenticated' }]);
      }
    });
  }
});

test('task creation writes PENDING task and initial assignment log', async () => {
  const { service, repository, transaction } = makeHarness();
  const result = await service.createTask({ ...admin, title: ' Proposal ', assignedToUserId: 22, customerId: 31 });
  assert.equal(result.task.status, 'PENDING');
  assert.equal(result.task.hostId, 7);
  assert.equal(result.task.createdByUserId, 9);
  assert.equal(repository.logs[0].action, 'CREATED');
  assert.equal(repository.logs[0].oldStatus, null);
  assert.equal(repository.logs[0].newStatus, 'PENDING');
  assert.equal(repository.logs[0].newAssignedToUserId, 22);
  assert.equal(transaction.committed, true);
});

test('task creation triggers one notification after commit', async () => {
  let committedWhenNotified = false;
  const notifications = {
    async notifyTaskCreated(task) {
      assert.equal(task.id, 101);
      committedWhenNotified = transaction.committed;
    },
    async notifyTaskReassigned() {},
  };
  const { service, transaction } = makeHarness(notifications);
  await service.createTask({ ...admin, title: 'Proposal', assignedToUserId: 22 });
  assert.equal(committedWhenNotified, true);
});

test('task creation rolls back when initial log insertion fails', async () => {
  let notificationCount = 0;
  const notifications = {
    async notifyTaskCreated() { notificationCount += 1; },
    async notifyTaskReassigned() {},
  };
  const { service, repository, transaction } = makeHarness(notifications);
  repository.failLog = true;
  await assert.rejects(service.createTask({ ...admin, title: 'Proposal', assignedToUserId: 22 }), /log insert failed/);
  assert.equal(transaction.rolledBack, true);
  assert.equal(notificationCount, 0);
});

test('task creation remains successful when notification delivery throws', async () => {
  const notifications = {
    async notifyTaskCreated() { throw new Error('delivery failed'); },
    async notifyTaskReassigned() {},
  };
  const { service, transaction } = makeHarness(notifications);
  const result = await service.createTask({ ...admin, title: 'Proposal', assignedToUserId: 22 });
  assert.equal(result.task.id, 101);
  assert.equal(transaction.committed, true);
});

test('task creation rejects users outside the tenant', async () => {
  const { service, transaction } = makeHarness();
  await assert.rejects(service.createTask({ ...admin, title: 'Proposal', assignedToUserId: 999 }), /eligible/);
  assert.equal(transaction.rolledBack, true);
});

test('task creation rejects mismatched customer and visit references', async () => {
  const { service } = makeHarness();
  await assert.rejects(service.createTask({ ...admin, title: 'Proposal', assignedToUserId: 22, customerId: 32, visitId: 41 }), /does not belong/);
});

test('task listing forces employees to their own assignments and preserves pagination', async (context) => {
  stubTaskDateSettings(context);
  const { service, repository } = makeHarness();
  await service.listTasks({ hostId: 7, userId: 22, isAdmin: false, page: 2, limit: 15, filters: { status: 'PENDING', overdueOnly: true, dueFrom: 1791853000, dueTo: 1791854000 } });
  assert.equal(repository.listParams.userId, 22);
  assert.equal(repository.listParams.isAdmin, false);
  assert.equal(repository.listParams.page, 2);
  assert.equal(repository.listParams.limit, 15);
  assert.equal(repository.listParams.filters.overdueOnly, true);
  assert.equal(repository.listParams.filters.dueFrom, 1791853000);
});

test('task listing converts each date filter using the host timezone without mutating the request', async (context) => {
  const settings = stubTaskDateSettings(context, 'America/New_York');
  const { service, repository } = makeHarness();
  for (const filters of [
    { dueDate: '2026-03-08' },
    { completedDate: '2026-11-01' },
    { dueDate: '2026-03-08', completedDate: '2026-11-01' },
    { dueDate: '08/03/2026', completedDate: '01/11/2026' },
    { dueDate: '2026-03-08', completedDate: '01/11/2026' },
    {},
  ]) {
    const originalFilters = { ...filters };
    await service.listTasks({ ...admin, filters });
    const normalized = repository.listParams.filters;
    assert.equal(normalized.dueFrom, filters.dueDate ? Date.parse('2026-03-08T05:00:00Z') / 1000 : undefined);
    assert.equal(normalized.dueTo, filters.dueDate ? Date.parse('2026-03-09T03:59:59Z') / 1000 : undefined);
    assert.equal(normalized.completedFrom, filters.completedDate ? Date.parse('2026-11-01T04:00:00Z') / 1000 : undefined);
    assert.equal(normalized.completedTo, filters.completedDate ? Date.parse('2026-11-02T04:59:59Z') / 1000 : undefined);
    assert.equal(normalized.dueDate, undefined);
    assert.equal(normalized.completedDate, undefined);
    assert.deepEqual(filters, originalFilters);
  }
  assert.equal(settings.mock.callCount(), 6);
});

test('task listing rejects invalid date filters and conflicting due bounds before querying tasks', async (context) => {
  stubTaskDateSettings(context);
  const { service, repository } = makeHarness();
  for (const filters of [
    { dueDate: '2026-02-30' }, { completedDate: '2026-13-01' },
    { dueDate: 1791853200 }, { completedDate: null },
    { dueDate: '2026-10-23', dueFrom: 1791853200 },
    { dueDate: '2026-10-23', dueTo: 1791853200 },
  ]) {
    await assert.rejects(service.listTasks({ ...admin, filters }), (error) => error.statusCode === 400);
    assert.equal(repository.listParams, null);
  }
});

test('task repository compares inclusive numeric date bounds while preserving tenant and employee restrictions', async (context) => {
  const query = context.mock.method(Task, 'findAndCountAll', async () => ({ rows: [], count: 0 }));
  const repository = new TaskRepository();
  const params = {
    hostId: 7, userId: 22, isAdmin: false, page: 1, limit: 20,
    sortBy: 'createdAt', sortOrder: 'DESC', now: 1800000000,
  };
  await repository.listTasks({ ...params, filters: { dueFrom: 100, dueTo: 200, completedFrom: 300, completedTo: 400, overdueOnly: true } });
  const { where } = query.mock.calls[0].arguments[0];
  assert.equal(where.hostId, 7);
  assert.equal(where.isDeleted, 0);
  assert.equal(where.assignedToUserId, 22);
  assert.deepEqual(where.dueAt, { [Op.gte]: 100, [Op.lte]: 200 });
  assert.deepEqual(where.completedAt, { [Op.gte]: 300, [Op.lte]: 400 });
  assert.deepEqual(where[Op.and][0], { dueAt: { [Op.lt]: params.now } });
  await repository.listTasks({ ...params, filters: {} });
  assert.equal(query.mock.calls[1].arguments[0].where.dueAt, undefined);
  assert.equal(query.mock.calls[1].arguments[0].where.completedAt, undefined);
});

test('task listing rejects invalid status, pagination, and sorting', async () => {
  const { service } = makeHarness();
  await assert.rejects(service.listTasks({ ...admin, filters: { status: 'OVERDUE' } }), /status is invalid/);
  await assert.rejects(service.listTasks({ ...admin, limit: 101 }), /limit must be/);
  await assert.rejects(service.listTasks({ ...admin, sortBy: 'hostId' }), /sortBy or sortOrder/);
});

test('details hide tasks that cannot be found within the authenticated tenant', async () => {
  const { service } = makeHarness();
  await assert.rejects(service.getTaskDetails({ hostId: 8, taskId: 101, userId: 9, isAdmin: true }), /Task not found/);
});

test('soft-deleted tasks are not visible', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 1 };
  await assert.rejects(service.getTaskDetails({ hostId: 7, taskId: 101, userId: 22, isAdmin: false }), /Task not found/);
});

test('employees cannot transition tasks assigned to another user', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 21, status: 'PENDING', isDeleted: 0 };
  await assert.rejects(service.startTask({ hostId: 7, taskId: 101, userId: 22, isAdmin: false }), /Task not found/);
  assert.equal(repository.logs.length, 0);
});

test('assigned employee can start a pending task once without duplicate logs', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 0 };
  const payload = { hostId: 7, taskId: 101, userId: 22, isAdmin: false };
  const first = await service.startTask(payload);
  const duplicate = await service.startTask(payload);
  assert.equal(first.task.status, 'IN_PROGRESS');
  assert.equal(repository.logs.length, 1);
  assert.equal(duplicate.changed, false);
});

test('invalid task transitions are rejected without adding logs', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 0 };
  await assert.rejects(service.completeTask({ hostId: 7, taskId: 101, userId: 22, isAdmin: false }), /Cannot completed/);
  assert.equal(repository.logs.length, 0);
});

test('transition remarks reject non-string values through validation errors', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'IN_PROGRESS', isDeleted: 0 };
  await assert.rejects(service.completeTask({ hostId: 7, taskId: 101, userId: 22, isAdmin: false, remarks: 42 }), /remarks must be a string/);
});

test('completion records timestamp and remarks once', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'IN_PROGRESS', isDeleted: 0 };
  const result = await service.completeTask({ hostId: 7, taskId: 101, userId: 22, isAdmin: false, remarks: 'Done' });
  assert.equal(result.task.status, 'COMPLETED');
  assert.ok(result.task.completedAt > 0);
  assert.equal(repository.logs[0].oldStatus, 'IN_PROGRESS');
  assert.equal(repository.logs[0].newStatus, 'COMPLETED');
  assert.equal(repository.logs[0].remarks, 'Done');
  const duplicate = await service.completeTask({ hostId: 7, taskId: 101, userId: 22, isAdmin: false, remarks: 'Done' });
  assert.equal(duplicate.changed, false);
  assert.equal(repository.logs.length, 1);
});

test('cancellation records previous status and cancelledAt', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 0 };
  const result = await service.cancelTask({ hostId: 7, taskId: 101, userId: 22, isAdmin: false });
  assert.equal(result.task.status, 'CANCELLED');
  assert.ok(result.task.cancelledAt > 0);
  assert.equal(repository.logs[0].oldStatus, 'PENDING');
  assert.equal(repository.logs[0].action, 'CANCELLED');
  await assert.rejects(service.cancelTask({ hostId: 7, taskId: 101, userId: 22, isAdmin: false }), /already cancelled/);
  assert.equal(repository.logs.length, 1);
});

test('assignment records both assignees while preserving status', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 21, status: 'IN_PROGRESS', isDeleted: 0 };
  const result = await service.assignTask({ ...admin, taskId: 101, assignedToUserId: 22 });
  assert.equal(result.task.status, 'IN_PROGRESS');
  assert.equal(repository.logs[0].action, 'REASSIGNED');
  assert.equal(repository.logs[0].oldAssignedToUserId, 21);
  assert.equal(repository.logs[0].newAssignedToUserId, 22);
});

test('assignment notification is triggered after commit with trusted previous and new assignees', async () => {
  let notificationArgs = null;
  let committedWhenNotified = false;
  const notifications = {
    async notifyTaskCreated() {},
    async notifyTaskReassigned(...args) {
      notificationArgs = args;
      committedWhenNotified = transaction.committed;
    },
  };
  const { service, repository, transaction } = makeHarness(notifications);
  repository.task = { id: 101, hostId: 7, assignedToUserId: 21, title: 'Proposal', status: 'PENDING', isDeleted: 0 };
  await service.assignTask({ ...admin, taskId: 101, assignedToUserId: 22 });
  assert.equal(committedWhenNotified, true);
  assert.equal(notificationArgs[0].assignedToUserId, 22);
  assert.equal(notificationArgs[1], 21);
  assert.equal(notificationArgs[2], 22);
});

test('unchanged assignment does not trigger a notification', async () => {
  let notificationCount = 0;
  const notifications = {
    async notifyTaskCreated() {},
    async notifyTaskReassigned() { notificationCount += 1; },
  };
  const { service, repository } = makeHarness(notifications);
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 0 };
  await service.assignTask({ ...admin, taskId: 101, assignedToUserId: 22 });
  assert.equal(notificationCount, 0);
});

test('metadata update with no actual changes does not add a log', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, title: 'Same', status: 'PENDING', isDeleted: 0 };
  const result = await service.updateTask({ ...admin, taskId: 101, title: 'Same' });
  assert.equal(result.changed, false);
  assert.equal(repository.logs.length, 0);
});

test('comments reject whitespace and users cannot comment on another tenant task', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 0 };
  await assert.rejects(service.addComment({ hostId: 7, taskId: 101, userId: 22, isAdmin: false, comment: '  ' }), /comment must contain/);
  await assert.rejects(service.addComment({ hostId: 8, taskId: 101, userId: 22, isAdmin: true, comment: 'Hello' }), /Task not found/);
});

test('comment creation records authenticated author and tenant', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 0 };
  const result = await service.addComment({ hostId: 7, taskId: 101, userId: 22, isAdmin: false, comment: '  Progress update  ' });
  assert.equal(result.comment.comment, 'Progress update');
  assert.equal(result.comment.userId, 22);
  assert.equal(result.comment.hostId, 7);
});

test('attachment upload rejects unsupported or mismatched file signatures and comments', async () => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 0 };
  const file = { buffer: Buffer.from('%PDF-1.7'), size: 8, mimetype: 'application/pdf', originalname: 'proof.pdf' };
  await assert.rejects(service.uploadAttachment({ hostId: 7, taskId: 101, userId: 22, isAdmin: false, taskCommentId: 77, file }), /Comment not found/);
  await assert.rejects(service.uploadAttachment({ hostId: 7, taskId: 101, userId: 22, isAdmin: false, file: { ...file, mimetype: 'image/png' } }), /Only valid/);
});

test('attachment upload preserves PDF filenames and sanitizes only unsafe characters', async (context) => {
  const { service, repository } = makeHarness();
  repository.task = { id: 101, hostId: 7, assignedToUserId: 22, status: 'PENDING', isDeleted: 0 };
  repository.createAttachment = async (data) => ({ id: 1, ...data });
  const upload = context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async () => ({
    url: 'https://example.com/proof.pdf', fileId: 'proof', raw: {},
  }));
  for (const [originalname, expected] of [
    ['September-2026-report.pdf', 'September-2026-report.pdf'],
    ['../folder\\proof\u0000\u001f.pdf', '._folder_proof__.pdf'],
  ]) {
    const file = { buffer: Buffer.from('%PDF-1.7'), size: 8, mimetype: 'application/pdf', originalname };
    const result = await service.uploadAttachment({ ...admin, taskId: 101, file });
    assert.equal(result.attachment.fileName, expected);
    assert.equal(result.attachment.fileUrl, 'https://example.com/proof.pdf');
  }
  assert.deepEqual(upload.mock.calls[0].arguments.slice(1), ['7/tasks', { accessMode: 'authenticated' }]);
});

test('authenticated media URLs preserve PDF and image formats without duplicating raw extensions', async (context) => {
  const buffer = Buffer.from('%PDF-1.7');
  let uploaded;
  const upload = context.mock.method(cloudinary.uploader, 'upload_stream', (options, callback) => ({
    end(received) {
      assert.equal(received, buffer);
      callback(undefined, uploaded);
    },
  }));
  for (const [resourceType, format, publicId, mimetype, extension] of [
    ['image', 'pdf', '7/tasks/proof', 'application/pdf', 'pdf'],
    ['image', 'png', '7/tasks/photo', 'image/png', 'png'],
    ['raw', undefined, '7/tasks/document.pdf', 'application/pdf', 'pdf'],
  ]) {
    uploaded = { resource_type: resourceType, format, public_id: publicId, version: 123,
      secure_url: 'https://example.com/uploaded' };
    const result = await mediaStorage.uploadBufferToMediaStorage({ buffer, mimetype }, '7/tasks', { accessMode: 'authenticated' });
    const pathname = new URL(result.url).pathname;
    assert.match(pathname, new RegExp(`/${resourceType}/authenticated/s--[^/]+--/v123/7/tasks/[^/]+\\.${extension}$`));
    assert.equal(pathname.endsWith('.pdf.pdf'), false);
    assert.equal(result.fileId, publicId);
  }
  assert.equal(upload.mock.calls[0].arguments[0].type, 'authenticated');
  assert.equal(upload.mock.calls[0].arguments[0].resource_type, 'auto');
  const publicResult = await mediaStorage.uploadBufferToMediaStorage({ buffer, mimetype: 'application/pdf' }, '7/tasks');
  assert.equal(publicResult.url, uploaded.secure_url);
});

test('task rules cover allowed transitions, file signatures, and Unix timestamps', () => {
  assert.equal(getTaskTransition('PENDING', 'IN_PROGRESS').action, 'STARTED');
  assert.equal(getTaskTransition('IN_PROGRESS', 'COMPLETED').timestampField, 'completedAt');
  assert.equal(getTaskTransition('COMPLETED', 'CANCELLED'), null);
  assert.equal(isValidTaskFile(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(isValidTaskFile(Buffer.from('not a pdf'), 'application/pdf'), false);
  assert.equal(isValidUnixTimestamp(1791853200), true);
  assert.equal(isValidUnixTimestamp(-1), false);
});

const express = require('express');
const http = require('node:http');
const https = require('node:https');
const jwt = require('jsonwebtoken');
const { EventEmitter } = require('node:events');
const { PassThrough } = require('node:stream');
const { once } = require('node:events');
const taskRepository = require('../../src/modules/task/repositories/task.repository').default;
const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
const { TaskAttachments } = require('../../src/models');
const { authMiddleware } = require('../../src/shared/middleware/auth.middleware');
const { errorHandler } = require('../../src/shared/middleware/error-handler.middleware');
const serializer = require('../../src/shared/middleware/response-serializer.middleware').default;
const taskRoutes = require('../../src/routes/v1/app/tasks.routes').default;

test('combined task creation HTTP contract and standalone API compatibility', async (context) => {
  const cookieParser = require('cookie-parser');
  const { requireAdminRole } = require('../../src/shared/middleware/auth.middleware');
  const { requireAdminCsrfToken } = require('../../src/shared/middleware/csrf.middleware');
  const { getAdminCsrfCookieName } = require('../../src/shared/utils/auth-cookie.util');
  const adminTaskRoutes = require('../../src/routes/v1/admin/tasks.routes').default;
  const taskService = require('../../src/modules/task/services/task.service').default;
  const { service, repository } = makeHarness();
  let user = { id: 9, hostId: 7, isAdminUser: 1 };
  context.mock.method(console, 'log', () => undefined);
  context.mock.method(console, 'error', () => undefined);
  context.mock.method(userRepository, 'findById', async () => user);
  const combined = context.mock.method(taskService, 'createTaskWithAttachment', service.createTaskWithAttachment.bind(service));
  context.mock.method(taskService, 'createTask', service.createTask.bind(service));
  context.mock.method(taskService, 'uploadAttachment', service.uploadAttachment.bind(service));
  context.mock.method(taskService, 'addComment', service.addComment.bind(service));
  const combinedComment = context.mock.method(taskService, 'addTaskCommentWithAttachment', service.addTaskCommentWithAttachment.bind(service));
  const upload = context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async () => ({
    url: 'https://example.com/proof.pdf', fileId: 'proof', raw: {},
  }));
  repository.createAttachment = async (data) => ({ id: 123, ...data });
  const app = express();
  app.use(express.json());
  app.use(cookieParser());
  app.use(serializer);
  app.use('/api/v1/admin/tasks', authMiddleware, requireAdminRole, requireAdminCsrfToken, adminTaskRoutes);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => {
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const token = jwt.sign({ userId: 9 }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const send = async (body, options = {}) => {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/tasks/${options.endpoint || 'createTaskWithAttachment'}`, {
      method: 'POST',
      headers: {
        ...(options.auth === false ? {} : { Authorization: `Bearer ${token}` }),
        ...(options.csrf === false ? {} : { Cookie: `${getAdminCsrfCookieName()}=test-csrf`, 'x-csrf-token': 'test-csrf' }),
        ...(options.json ? { 'Content-Type': 'application/json' } : {}),
      },
      body: options.json ? JSON.stringify(body) : body,
    });
    return { status: response.status, body: await response.json() };
  };
  const form = (files = 1, size = 8, field = 'file') => {
    const body = new FormData();
    for (const [key, value] of Object.entries({
      title: 'Proposal', assignedToUserId: '22', customerId: '31', visitId: '41',
      dueAt: '1791853200', priority: 'HIGH', remarks: 'Evidence',
      hostId: '999', userId: '999', isAdmin: 'false', taskId: '999', taskCommentId: '888',
    })) body.set(key, value);
    for (let index = 0; index < files; index += 1) {
      body.append(field, new Blob([size === 8 ? Buffer.from('%PDF-1.7') : Buffer.alloc(size)], { type: 'application/pdf' }), 'proof.pdf');
    }
    return body;
  };

  const result = await send(form());
  assert.equal(result.status, 200);
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, 'Task created with attachment successfully');
  assert.equal(result.body.data.task.id, 101);
  assert.equal(result.body.data.task.hostId, 7);
  assert.equal(result.body.data.task.createdByUserId, 9);
  assert.equal(result.body.data.task.dueAt, 1791853200);
  assert.equal(result.body.data.attachment.taskId, 101);
  assert.equal(result.body.data.attachment.taskCommentId, null);
  assert.equal(combined.mock.calls[0].arguments[0].assignedToUserId, 22);
  assert.equal(combined.mock.calls[0].arguments[0].customerId, 31);
  assert.equal(combined.mock.calls[0].arguments[0].visitId, 41);

  assert.equal((await send(form(), { auth: false })).status, 401);
  assert.equal((await send(form(), { csrf: false })).status, 401);
  user = { ...user, isAdminUser: 0 };
  assert.equal((await send(form())).status, 403);
  user = { ...user, isAdminUser: 1 };
  assert.equal(combined.mock.callCount(), 1);
  for (const invalidForm of [form(0), form(2), form(1, 10 * 1024 * 1024 + 1), form(1, 8, 'attachment')]) {
    const invalid = await send(invalidForm);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.success, false);
  }
  const invalidDetails = form();
  invalidDetails.set('assignedToUserId', 'not-an-id');
  assert.equal((await send(invalidDetails)).status, 400);
  assert.equal(upload.mock.callCount(), 1);

  const commentForm = () => {
    const body = form();
    body.set('taskId', '101');
    body.set('comment', ' Progress update ');
    return body;
  };
  const commentOptions = { endpoint: 'addTaskCommentWithAttachment' };
  const commentResult = await send(commentForm(), commentOptions);
  assert.equal(commentResult.status, 200);
  assert.equal(commentResult.body.success, true);
  assert.equal(commentResult.body.message, 'Task comment added with attachment successfully');
  assert.equal(commentResult.body.data.comment.comment, 'Progress update');
  assert.equal(commentResult.body.data.comment.hostId, 7);
  assert.equal(commentResult.body.data.comment.userId, 9);
  assert.equal(commentResult.body.data.attachment.taskId, 101);
  assert.equal(commentResult.body.data.attachment.taskCommentId, commentResult.body.data.comment.id);
  assert.equal(commentResult.body.data.attachment.uploadedByUserId, 9);
  assert.equal(combinedComment.mock.calls[0].arguments[0].taskId, 101);
  assert.equal(combinedComment.mock.calls[0].arguments[0].taskCommentId, undefined);
  assert.equal((await send(commentForm(), { ...commentOptions, auth: false })).status, 401);
  assert.equal((await send(commentForm(), { ...commentOptions, csrf: false })).status, 401);
  user = { ...user, isAdminUser: 0 };
  assert.equal((await send(commentForm(), commentOptions)).status, 403);
  user = { ...user, isAdminUser: 1 };
  assert.equal(combinedComment.mock.callCount(), 1);
  for (const invalidForm of [form(0), form(2), form(1, 10 * 1024 * 1024 + 1), form(1, 8, 'attachment')]) {
    invalidForm.set('taskId', '101');
    invalidForm.set('comment', 'Update');
    const invalid = await send(invalidForm, commentOptions);
    assert.equal(invalid.status, 400);
    assert.equal(invalid.body.success, false);
  }
  const blankComment = commentForm();
  blankComment.set('comment', ' ');
  assert.equal((await send(blankComment, commentOptions)).status, 400);
  assert.equal(upload.mock.callCount(), 2);
  const standaloneComment = await send({ taskId: 101, comment: 'Standalone update' }, { endpoint: 'addTaskComment', json: true });
  assert.equal(standaloneComment.body.success, true);
  assert.deepEqual(Object.keys(standaloneComment.body.data), ['comment']);

  const standaloneTask = await send({ title: 'Standalone', assignedToUserId: 22 }, { endpoint: 'createTask', json: true });
  assert.equal(standaloneTask.body.success, true);
  assert.deepEqual(Object.keys(standaloneTask.body.data), ['task']);
  const attachmentForm = new FormData();
  attachmentForm.set('taskId', '101');
  attachmentForm.set('file', new Blob([Buffer.from('%PDF-1.7')], { type: 'application/pdf' }), 'proof.pdf');
  const standaloneAttachment = await send(attachmentForm, { endpoint: 'uploadTaskAttachment' });
  assert.equal(standaloneAttachment.body.success, true);
  assert.deepEqual(Object.keys(standaloneAttachment.body.data), ['attachment']);
  assert.equal(standaloneAttachment.body.data.attachment.taskId, 101);
});

async function downloadHarness(context) {
  context.mock.method(console, 'error', () => undefined);
  const state = {
    user: { id: 22, hostId: 7, isAdminUser: 0 },
    task: { id: 101, hostId: 7, assignedToUserId: 22, isDeleted: 0 },
    attachment: {
      id: 123, hostId: 7, taskId: 101, taskCommentId: null, fileName: 'inspection-report.pdf',
      fileType: 'application/pdf', fileSizeBytes: 999,
      fileUrl: cloudinary.url('7/tasks/proof', { secure: true, type: 'authenticated', sign_url: true, version: 123, format: 'pdf' }),
    },
    comment: null,
    bytes: Buffer.from('%PDF-1.7\nfixture'),
    upstreamStatus: 200,
    upstreamType: 'application/pdf',
    mode: 'success',
    requests: [],
    streams: [],
    signals: [],
    errors: [],
  };
  context.mock.method(userRepository, 'findById', async () => state.user);
  const lookup = context.mock.method(TaskAttachments, 'findOne', async ({ where }) => {
    assert.deepEqual(where, { hostId: 7, id: 123 });
    return state.attachment?.hostId === where.hostId ? state.attachment : null;
  });
  context.mock.method(taskRepository, 'getTask', async (hostId, taskId) =>
    state.task && state.task.hostId === hostId && state.task.id === taskId && state.task.isDeleted === 0 ? state.task : null);
  context.mock.method(taskRepository, 'findComment', async (hostId, taskId, id) =>
    state.comment && state.comment.hostId === hostId && state.comment.taskId === taskId && state.comment.id === id ? state.comment : null);
  const upstream = context.mock.method(https, 'get', (url, options, callback) => {
    state.requests.push(url);
    state.signals.push(options.signal);
    assert.equal(options.headers['Accept-Encoding'], 'identity');
    const request = new EventEmitter();
    let response;
    request.destroy = (error) => {
      if (error) request.emit('error', error);
      else response?.destroy();
      return request;
    };
    request.setTimeout = (milliseconds, callbackTimeout) => {
      assert.equal(milliseconds, 15000);
      request.timeout = callbackTimeout;
    };
    const onAbort = () => {
      response?.destroy();
      const error = new Error('aborted');
      error.name = 'AbortError';
      request.emit('error', error);
    };
    options.signal.addEventListener('abort', onAbort, { once: true });
    process.nextTick(() => {
      if (state.mode === 'timeout') return request.timeout();
      if (state.mode === 'network-error') return request.emit('error', new Error('https://private-url.invalid/signature'));
      response = new PassThrough();
      response.statusCode = state.upstreamStatus;
      response.headers = { 'content-type': state.upstreamType };
      if (state.mode === 'length') response.headers['content-length'] = String(state.bytes.length);
      if (state.mode === 'bad-length') response.headers['content-length'] = '-1';
      response.complete = false;
      response.once('close', () => options.signal.removeEventListener('abort', onAbort));
      state.streams.push(response);
      callback(response);
      if (state.mode === 'immediate-error') {
        response.destroy(new Error('https://private-url.invalid/signature'));
      } else if (state.mode === 'pre-stream-error') {
        setImmediate(() => response.destroy(new Error('https://private-url.invalid/signature')));
      } else if (state.mode === 'paused' || state.mode === 'interrupted' || state.mode === 'mid-timeout') {
        response.write(state.bytes);
        if (state.mode === 'interrupted') setImmediate(() => response.destroy(new Error('private upstream failed')));
        if (state.mode === 'mid-timeout') setImmediate(() => request.timeout());
      } else {
        response.complete = true;
        response.end(state.bytes);
      }
    });
    return request;
  });
  const app = express();
  app.use(express.json());
  app.use(serializer);
  app.use('/api/v1/app/task', authMiddleware, taskRoutes);
  app.use((error, req, res, next) => {
    state.errors.push(error);
    errorHandler(error, req, res, next);
  });
  const server = app.listen(0, '127.0.0.1');
  await once(server, 'listening');
  context.after(async () => {
    for (const stream of state.streams) stream.destroy();
    server.closeAllConnections();
    await new Promise((resolve) => server.close(resolve));
  });
  const token = jwt.sign({ userId: 22 }, process.env.JWT_SECRET, { expiresIn: '5m' });
  const send = (body = { attachmentId: 123 }, options = {}) => new Promise((resolve, reject) => {
    const request = http.request({
      hostname: '127.0.0.1', port: server.address().port, method: 'POST',
      path: '/api/v1/app/task/' + (options.endpoint || 'downloadAttachment'),
      headers: { 'Content-Type': 'application/json', ...(options.auth === false ? {} : { Authorization: options.auth || `Bearer ${token}` }) },
    }, (response) => {
      if (options.onResponse) return options.onResponse(response, resolve);
      const chunks = [];
      response.on('data', (chunk) => chunks.push(chunk));
      response.on('end', () => resolve({ status: response.statusCode, headers: response.headers, bytes: Buffer.concat(chunks) }));
      response.on('error', reject);
    });
    request.on('error', reject);
    request.end(JSON.stringify(body));
  });
  return { state, send, lookup, upstream };
}

test('attachment download HTTP security and streaming', async (context) => {
  await context.test('streams PDF bytes with safe headers, not JSON or a redirect', async (context) => {
    const { state, send } = await downloadHarness(context);
    state.mode = 'length';
    const result = await send({ attachmentId: 123, hostId: 999, userId: 999, isAdmin: true, fileUrl: 'http://localhost/' });
    assert.equal(result.status, 200);
    assert.deepEqual(result.bytes, state.bytes);
    assert.equal(result.headers['content-type'], 'application/pdf');
    assert.equal(result.headers['content-disposition'], 'attachment; filename="inspection-report.pdf"');
    assert.equal(result.headers['content-length'], String(state.bytes.length));
    assert.equal(result.headers['cache-control'], 'private, no-store');
    assert.equal(result.headers['x-content-type-options'], 'nosniff');
    assert.equal(result.headers.location, undefined);
    assert.doesNotMatch(JSON.stringify(result.headers) + result.bytes.toString(), /cloudinary|https:/i);
    assert.equal(state.errors.length, 0);
  });

  await context.test('streams PNG, JPEG and WEBP with the matching metadata', async (context) => {
    const { state, send } = await downloadHarness(context);
    for (const [type, extension] of [['image/png', 'png'], ['image/jpeg', 'jpeg'], ['image/webp', 'webp']]) {
      state.attachment.fileType = state.upstreamType = type;
      state.attachment.fileName = `photo.${extension}`;
      state.bytes = Buffer.from(`binary ${extension}`);
      const result = await send();
      assert.equal(result.status, 200);
      assert.deepEqual(result.bytes, state.bytes);
      assert.equal(result.headers['content-type'], type);
      assert.match(result.headers['content-disposition'], new RegExp(`photo\\.${extension}`));
      assert.equal(result.headers['content-length'], undefined);
    }
  });

  await context.test('rejects missing and malformed IDs before database or network access', async (context) => {
    const { send, lookup, upstream } = await downloadHarness(context);
    for (const attachmentId of [undefined, null, 0, -1, 1.5, true, [], [123], {}, '1e2', '1.5', ' 123 ', 'no', Number.MAX_SAFE_INTEGER + 1]) {
      const result = await send({ attachmentId });
      assert.equal(result.status, 400);
      assert.equal(JSON.parse(result.bytes).code, 'INVALID_ATTACHMENT_ID');
    }
    assert.equal(lookup.mock.callCount(), 0);
    assert.equal(upstream.mock.callCount(), 0);
  });

  await context.test('rejects missing, invalid, expired, and unknown-user authentication', async (context) => {
    const { state, send, lookup } = await downloadHarness(context);
    for (const auth of [false, 'Bearer invalid', `Bearer ${jwt.sign({ userId: 22 }, process.env.JWT_SECRET, { expiresIn: -1 })}`]) {
      const result = await send({ attachmentId: 123 }, { auth });
      assert.equal(result.status, 401);
      assert.equal(JSON.parse(result.bytes).success, false);
    }
    state.user = null;
    assert.equal((await send()).status, 401);
    assert.equal(lookup.mock.callCount(), 0);
  });

  await context.test('hides missing and cross-host attachments, including from admins', async (context) => {
    const { state, send, upstream } = await downloadHarness(context);
    state.attachment.hostId = 8;
    state.user.isAdminUser = 1;
    assert.equal((await send()).status, 404);
    state.attachment = null;
    assert.equal((await send()).status, 404);
    assert.equal(upstream.mock.callCount(), 0);
  });

  await context.test('rejects unassigned users, deleted/missing/cross-host tasks and dangling comments', async (context) => {
    const { state, send, upstream } = await downloadHarness(context);
    state.task.assignedToUserId = 99;
    assert.equal((await send({ attachmentId: 123, isAdmin: true })).status, 404);
    state.task.assignedToUserId = 22;
    state.task.isDeleted = 1;
    assert.equal((await send()).status, 404);
    state.task.isDeleted = 0;
    state.task.hostId = 8;
    assert.equal((await send()).status, 404);
    state.task.hostId = 7;
    state.attachment.taskCommentId = 77;
    assert.equal((await send()).status, 404);
    state.comment = { id: 77, hostId: 8, taskId: 101 };
    assert.equal((await send()).status, 404);
    state.comment = { id: 77, hostId: 7, taskId: 999 };
    assert.equal((await send()).status, 404);
    state.task = null;
    assert.equal((await send()).status, 404);
    assert.equal(upstream.mock.callCount(), 0);
  });

  await context.test('allows task comments by another author and same-host admin access', async (context) => {
    const { state, send } = await downloadHarness(context);
    state.attachment.taskCommentId = 77;
    state.comment = { id: 77, hostId: 7, taskId: 101, userId: 99 };
    assert.equal((await send()).status, 200);
    state.task.assignedToUserId = 99;
    state.user.isAdminUser = 1;
    assert.equal((await send()).status, 200);
  });

  await context.test('rejects untrusted URL destinations, folders and delivery paths without fetching', async (context) => {
    const { state, send, upstream } = await downloadHarness(context);
    for (const fileUrl of [
      'http://127.0.0.1/private', 'https://res.cloudinary.com.evil.test/task-download-test/image/upload/v1/7/tasks/a.pdf',
      'https://user:secret@res.cloudinary.com/task-download-test/image/upload/v1/7/tasks/a.pdf',
      'https://res.cloudinary.com/other-cloud/image/upload/v1/7/tasks/a.pdf',
      'https://res.cloudinary.com/task-download-test/image/upload/v1/8/tasks/a.pdf',
      'https://res.cloudinary.com/task-download-test/image/authenticated/v1/7/tasks/a.pdf',
      'https://res.cloudinary.com/task-download-test/image/upload/v1/7/tasks/a.pdf?url=http://localhost',
      'https://res.cloudinary.com/task-download-test/image/upload/v1/7/tasks/a%2fsecret.pdf',
      'https://res.cloudinary.com:444/task-download-test/image/upload/v1/7/tasks/a.pdf',
      'https://res.cloudinary.com/task-download-test/image/upload/w_100/v1/7/tasks/a.pdf',
    ]) {
      state.attachment.fileUrl = fileUrl;
      const result = await send();
      assert.equal(result.status, 502);
      assert.doesNotMatch(result.bytes.toString(), /https:|cloudinary|secret/);
    }
    assert.equal(upstream.mock.callCount(), 0);
  });

  await context.test('supports existing public upload and signed raw Cloudinary delivery', async (context) => {
    const { state, send } = await downloadHarness(context);
    for (const [resource_type, type, sign_url] of [['image', 'upload', false], ['raw', 'authenticated', true]]) {
      state.attachment.fileUrl = cloudinary.url('7/tasks/proof.pdf', { secure: true, resource_type, type, sign_url, version: 123 });
      assert.equal((await send()).status, 200);
    }
  });

  await context.test('maps upstream failures and redirects to URL-free JSON errors', async (context) => {
    const { state, send } = await downloadHarness(context);
    for (const status of [301, 302, 403, 404, 500]) {
      state.upstreamStatus = status;
      const result = await send();
      assert.equal(result.status, 502);
      assert.equal(result.headers.location, undefined);
      assert.equal(JSON.parse(result.bytes).code, 'TASK_ATTACHMENT_DOWNLOAD_FAILED');
      assert.doesNotMatch(result.bytes.toString(), /https:|cloudinary/i);
    }
    state.mode = 'network-error';
    const result = await send();
    assert.equal(result.status, 502);
    assert.doesNotMatch(result.bytes.toString(), /https:|private-url/i);
  });

  await context.test('maps upstream timeout to 504 and pre-stream errors to one JSON response', async (context) => {
    const { state, send } = await downloadHarness(context);
    state.mode = 'timeout';
    assert.equal((await send()).status, 504);
    state.mode = 'pre-stream-error';
    const result = await send();
    assert.equal(result.status, 502);
    assert.equal(result.headers['content-disposition'], undefined);
    assert.equal(result.headers['content-length'], String(result.bytes.length));
    assert.equal(state.errors.length, 2);
    state.mode = 'immediate-error';
    assert.equal((await send()).status, 502);
    assert.equal(state.errors.length, 3);
  });

  await context.test('rejects upstream MIME mismatch and ignores invalid content length', async (context) => {
    const { state, send } = await downloadHarness(context);
    state.upstreamType = 'text/html';
    assert.equal((await send()).status, 502);
    state.upstreamType = 'application/octet-stream';
    state.mode = 'bad-length';
    const result = await send();
    assert.equal(result.status, 200);
    assert.equal(result.headers['content-type'], 'application/pdf');
    assert.equal(result.headers['content-length'], undefined);
  });

  await context.test('sanitizes unsafe filenames, preserves extensions and limits length', async (context) => {
    const { state, send } = await downloadHarness(context);
    for (const fileName of ['../folder\\report\r\n".pdf', `${'x'.repeat(300)}.pdf`, 'report.exe', '']) {
      state.attachment.fileName = fileName;
      const result = await send();
      assert.equal(result.status, 200);
      const disposition = result.headers['content-disposition'];
      assert.match(disposition, /^attachment; filename="[^"\r\n\\/]+\.pdf"$/);
      assert.ok(disposition.length < 260);
    }
  });

  await context.test('delivers a first chunk before upstream completion and aborts on client disconnect', { timeout: 5000 }, async (context) => {
    const { state, send } = await downloadHarness(context);
    state.mode = 'paused';
    await send(undefined, { onResponse(response, resolve) {
      response.once('data', (chunk) => {
        assert.deepEqual(chunk, state.bytes);
        assert.equal(state.streams[0].complete, false);
        response.destroy();
        resolve();
      });
    } });
    if (!state.signals[0].aborted) await once(state.signals[0], 'abort');
    assert.equal(state.signals[0].aborted, true);
    assert.equal(state.streams[0].destroyed, true);
    assert.equal(state.errors.length, 0);
  });

  await context.test('mid-stream interruption and timeout close the connection without appended JSON', async (context) => {
    const { state, send } = await downloadHarness(context);
    for (const mode of ['interrupted', 'mid-timeout']) {
      state.mode = mode;
      const result = await send(undefined, { onResponse(response, resolve) {
        const chunks = [];
        response.on('data', (chunk) => chunks.push(chunk));
        response.on('error', () => undefined);
        response.once('close', () => resolve({ complete: response.complete, bytes: Buffer.concat(chunks) }));
      } });
      assert.equal(result.complete, false);
      assert.deepEqual(result.bytes, state.bytes);
      assert.equal(state.errors.length, 0);
    }
  });

  await context.test('metadata and list attachment endpoints retain their JSON contracts', async (context) => {
    const { state, send } = await downloadHarness(context);
    context.mock.method(taskRepository, 'getAttachment', async () => state.attachment);
    context.mock.method(taskRepository, 'getAttachments', async () => ({ rows: [state.attachment], count: 1 }));
    const metadata = await send({ taskId: 101, attachmentId: 123 }, { endpoint: 'getTaskAttachment' });
    assert.equal(JSON.parse(metadata.bytes).data.attachment.id, 123);
    const list = await send({ taskId: 101 }, { endpoint: 'getTaskAttachments' });
    assert.equal(JSON.parse(list.bytes).data.attachments[0].id, 123);
  });
});