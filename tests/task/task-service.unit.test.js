require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { TaskService } = require('../../src/modules/task/services/task.service');
const { getTaskTransition, isValidTaskFile, isValidUnixTimestamp } = require('../../src/modules/task/services/task-rules.util');

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

function makeHarness() {
  const repository = new FakeTaskRepository();
  const transaction = { committed: false, rolledBack: false, async commit() { this.committed = true; }, async rollback() { this.rolledBack = true; } };
  const service = new TaskService(repository, async () => transaction);
  return { service, repository, transaction };
}

const admin = { hostId: 7, userId: 9, isAdmin: true };

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

test('task creation rolls back when initial log insertion fails', async () => {
  const { service, repository, transaction } = makeHarness();
  repository.failLog = true;
  await assert.rejects(service.createTask({ ...admin, title: 'Proposal', assignedToUserId: 22 }), /log insert failed/);
  assert.equal(transaction.rolledBack, true);
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

test('task listing forces employees to their own assignments and preserves pagination', async () => {
  const { service, repository } = makeHarness();
  await service.listTasks({ hostId: 7, userId: 22, isAdmin: false, page: 2, limit: 15, filters: { status: 'PENDING', overdueOnly: true, dueFrom: 1791853000, dueTo: 1791854000 } });
  assert.equal(repository.listParams.userId, 22);
  assert.equal(repository.listParams.isAdmin, false);
  assert.equal(repository.listParams.page, 2);
  assert.equal(repository.listParams.limit, 15);
  assert.equal(repository.listParams.filters.overdueOnly, true);
  assert.equal(repository.listParams.filters.dueFrom, 1791853000);
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

test('task rules cover allowed transitions, file signatures, and Unix timestamps', () => {
  assert.equal(getTaskTransition('PENDING', 'IN_PROGRESS').action, 'STARTED');
  assert.equal(getTaskTransition('IN_PROGRESS', 'COMPLETED').timestampField, 'completedAt');
  assert.equal(getTaskTransition('COMPLETED', 'CANCELLED'), null);
  assert.equal(isValidTaskFile(Buffer.from('%PDF-1.7'), 'application/pdf'), true);
  assert.equal(isValidTaskFile(Buffer.from('not a pdf'), 'application/pdf'), false);
  assert.equal(isValidUnixTimestamp(1791853200), true);
  assert.equal(isValidUnixTimestamp(-1), false);
});