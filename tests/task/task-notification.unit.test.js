require('ts-node/register/transpile-only');

process.env.CLOUDINARY_CLOUD_NAME = 'task-notification-test';
process.env.CLOUDINARY_API_KEY = 'test-key';
process.env.CLOUDINARY_API_SECRET = 'test-secret';
process.env.JWT_SECRET = 'task-notification-test-signing-secret';

const test = require('node:test');
const assert = require('node:assert/strict');
const { TaskNotificationService } = require('../../src/modules/notifications/task/taskNotificationService');

function makeHarness(options = {}) {
  const sent = [];
  const logs = [];
  const taskRepository = {
    async findAssignee(hostId, userId) {
      return options.eligible === false || (options.allowedHostId && hostId !== options.allowedHostId)
        ? null
        : { id: userId };
    },
  };
  const userRepository = {
    async findActiveDevicesByUser() {
      return options.devices || [{
        id: 1,
        deviceId: 'device-1',
        fcmToken: 'token-1',
      }];
    },
  };
  const notificationFacade = {
    async send(request) {
      sent.push(request);
      if (options.deliveryFails) return { success: false, error: 'provider error' };
      return { success: true, provider: 'FIREBASE', messageId: 'message-1' };
    },
  };
  const pushNotificationsRepository = {
    async savePushNotification(payload) {
      logs.push(payload);
      if (options.logFails) throw new Error('log failed');
      return { id: logs.length };
    },
  };
  return {
    service: new TaskNotificationService(taskRepository, userRepository, notificationFacade, pushNotificationsRepository),
    sent,
    logs,
  };
}

const task = {
  id: 101,
  hostId: 7,
  title: 'Quarterly review',
  taskNumber: 'WK-101',
  assignedToUserId: 22,
};

test('task creation sends one visible task-details notification to its assignee', async () => {
  const { service, sent, logs } = makeHarness();
  await service.notifyTaskCreated(task);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].channel, 'PUSH');
  assert.equal(sent[0].payload.token, 'token-1');
  assert.deepEqual(sent[0].payload.data, logs[0].payload);
  assert.equal(sent[0].payload.data.notificationType, 'TASK');
  assert.equal(sent[0].payload.data.action, 'OPEN_TASK_DETAILS');
  assert.equal(sent[0].payload.data.event, 'TASK_CREATED');
  assert.equal(sent[0].payload.data.taskId, '101');
  assert.equal(sent[0].payload.data.taskNumber, 'WK-101');
  assert.equal(Object.hasOwn(sent[0].payload.data, 'ticketNumber'), false);
  assert.equal(sent[0].payload.data.title, 'New Task Assigned');
  assert.equal(sent[0].payload.data.body, 'You have been assigned Task #WK-101: Quarterly review.');
  assert.equal(logs[0].notificationType, 'TASK');
  assert.equal(logs[0].status, 'SENT');
});

test('creation with no assignee does not send a push', async () => {
  const { service, sent } = makeHarness();
  await service.notifyTaskCreated({ ...task, assignedToUserId: null });
  assert.equal(sent.length, 0);
});

test('reassignment sends distinct old and new assignee events', async () => {
  const { service, sent } = makeHarness();
  await service.notifyTaskReassigned(task, 21, 22);
  assert.equal(sent.length, 2);
  assert.equal(sent[0].payload.data.title, 'Task Reassigned');
  assert.equal(sent[0].payload.data.body, 'Task #WK-101: Quarterly review has been reassigned to another team member.');
  assert.equal(sent[1].payload.data.title, 'Task Assigned to You');
  assert.equal(sent[1].payload.data.body, 'You have been assigned Task #WK-101: Quarterly review.');
  assert.equal(sent[0].payload.data.event, 'TASK_REASSIGNED');
  assert.equal(sent[1].payload.data.event, 'TASK_REASSIGNED');
  assert.ok(sent.every((request) => request.payload.data.taskNumber === 'WK-101'));
});

test('initial assignment does not send a previous-assignee notification', async () => {
  const { service, sent } = makeHarness();
  await service.notifyTaskReassigned(task, null, 22);
  assert.equal(sent.length, 1);
  assert.equal(sent[0].payload.data.title, 'Task Assigned to You');
});

test('unchanged or missing assignments do not generate notifications', async () => {
  const { service, sent } = makeHarness();
  await service.notifyTaskReassigned(task, 22, 22);
  await service.notifyTaskReassigned(task, 21, null);
  assert.equal(sent.length, 0);
});

test('recipient is scoped to the task host and missing device tokens are skipped', async () => {
  const crossHost = makeHarness({ allowedHostId: 8 });
  await crossHost.service.notifyTaskCreated(task);
  assert.equal(crossHost.sent.length, 0);

  const noToken = makeHarness({ devices: [{ id: 1, deviceId: 'device-1', fcmToken: '  ' }] });
  await noToken.service.notifyTaskCreated(task);
  assert.equal(noToken.sent.length, 0);
});

test('duplicate active device tokens receive only one delivery', async () => {
  const { service, sent, logs } = makeHarness({
    devices: [
      { id: 1, deviceId: 'device-1', fcmToken: 'same-token' },
      { id: 2, deviceId: 'device-2', fcmToken: ' same-token ' },
      { id: 3, deviceId: 'device-3', fcmToken: 'other-token' },
    ],
  });
  await service.notifyTaskCreated(task);
  assert.equal(sent.length, 2);
  assert.equal(logs.length, 2);
});

test('push and delivery-log failures do not escape notification processing', async () => {
  const { service, sent, logs } = makeHarness({ deliveryFails: true, logFails: true });
  await assert.doesNotReject(service.notifyTaskCreated(task));
  assert.equal(sent.length, 1);
  assert.equal(logs[0].status, 'FAILED');
  assert.equal(logs[0].failureReason, 'Push delivery failed');
});

test('task payload falls back cleanly when title and task number are unavailable', async () => {
  const { service, sent } = makeHarness();
  await service.notifyTaskCreated({ ...task, title: null, taskNumber: null });
  assert.equal(sent[0].payload.data.taskNumber, undefined);
  assert.equal(sent[0].payload.data.body, 'You have been assigned a task: Untitled task.');
  assert.ok(Object.values(sent[0].payload.data).every((value) => typeof value === 'string'));
});
