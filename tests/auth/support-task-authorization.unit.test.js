require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../src/models');
const taskController = require('../../src/modules/task/controllers/task.controller').default;
const taskService = require('../../src/modules/task/services/task.service').default;

test.after(async () => {
  await models.sequelize.close();
});

function createRequest(overrides = {}) {
  return {
    body: { hostId: 99, taskId: 12, title: 'Support task', assignedToUserId: 31, comment: 'Note' },
    user: { id: 7, hostId: 41, roleId: 1, isAdminUser: 0, isSuperAdmin: 1 },
    authContext: {
      isSupportSession: true,
      switchSessionId: 'switch-id',
      originalHostId: 5,
      currentHostId: 41,
      contextVersion: 2,
      accessMode: 'SUPPORT_FULL',
    },
    ...overrides,
  };
}

function createResponse() {
  return { json(body) { this.body = body; return this; } };
}

test('task reads and mutations use the support host, original user, and support admin scope', async (context) => {
  const calls = [];
  const serviceMethods = [
    'getDashboardStats', 'getKanbanBoard', 'listTasks', 'getTaskDetails',
    'listActivity', 'addComment', 'listComments', 'uploadAttachment',
    'listAttachments', 'getAttachment', 'createTask', 'updateTask',
    'assignTask', 'startTask', 'completeTask', 'cancelTask',
  ];
  for (const method of serviceMethods) {
    context.mock.method(taskService, method, async (payload) => {
      calls.push({ method, payload });
      return {};
    });
  }

  const request = createRequest();
  const invoke = async (handler) => handler(request, createResponse(), (error) => {
    if (error) throw error;
  });
  await invoke(taskController.dashboardStats);
  await invoke(taskController.kanbanBoard);
  await invoke(taskController.getTasks);
  await invoke(taskController.getTaskDetails);
  await invoke(taskController.getTaskActivity);
  await invoke(taskController.addTaskComment);
  await invoke(taskController.getTaskComments);
  await invoke(taskController.uploadTaskAttachment);
  await invoke(taskController.getTaskAttachments);
  await invoke(taskController.getTaskAttachment);
  await invoke(taskController.createTask);
  await invoke(taskController.updateTask);
  await invoke(taskController.assignTask);
  await invoke(taskController.startTask);
  await invoke(taskController.completeTask);
  await invoke(taskController.cancelTask);

  assert.equal(calls.length, serviceMethods.length);
  for (const { payload } of calls) {
    assert.equal(payload.hostId, 41);
    assert.equal(payload.userId, 7);
    assert.equal(payload.isAdmin, true);
  }
});

test('normal admin and employee task authorization remains based on isAdminUser', async (context) => {
  const calls = [];
  context.mock.method(taskService, 'getTaskDetails', async (payload) => {
    calls.push(payload);
    return {};
  });

  await taskController.getTaskDetails(
    createRequest({
      authContext: undefined,
      user: { id: 8, hostId: 41, roleId: 2, isAdminUser: 1, isSuperAdmin: 0 },
    }),
    createResponse(),
    (error) => { if (error) throw error; }
  );
  await taskController.getTaskDetails(
    createRequest({
      authContext: undefined,
      user: { id: 9, hostId: 41, roleId: 3, isAdminUser: 0, isSuperAdmin: 0 },
    }),
    createResponse(),
    (error) => { if (error) throw error; }
  );

  assert.equal(calls[0].isAdmin, true);
  assert.equal(calls[1].isAdmin, false);
  assert.equal(calls[0].userId, 8);
  assert.equal(calls[1].userId, 9);
});