require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const leaveAppService = require('../../src/modules/leave/services/leave-app.service').default;
const leaveRequestApprovalService = require('../../src/modules/leave/services/leave-request-approval.service').default;
const {
  asNumber,
  createRequestLocalId,
  getBalanceSnapshot,
  resolveLeaveTestContext,
} = require('./helpers/leave-test-context');

test('idempotency: duplicate requestLocalId returns same leave request', async () => {
  const ctx = await resolveLeaveTestContext();

  const requestLocalId = createRequestLocalId('leave-idempotency');

  const [first, second] = await Promise.all([
    leaveAppService.createLeaveRequest({
      hostId: ctx.hostId,
      userId: ctx.userId,
      leaveTypeId: ctx.leaveTypeId,
      fromDate: ctx.fromDate,
      tillDate: ctx.tillDate,
      reason: 'idempotency test',
      requestLocalId,
      days: ctx.days,
    }),
    leaveAppService.createLeaveRequest({
      hostId: ctx.hostId,
      userId: ctx.userId,
      leaveTypeId: ctx.leaveTypeId,
      fromDate: ctx.fromDate,
      tillDate: ctx.tillDate,
      reason: 'idempotency test duplicate',
      requestLocalId,
      days: ctx.days,
    }),
  ]);

  const firstId = asNumber(first?.request?.id);
  const secondId = asNumber(second?.request?.id);

  assert(firstId > 0, 'First request id missing');
  assert.equal(secondId, firstId, 'Duplicate requestLocalId should return same request id');
});

test('concurrency: duplicate approvals do not double-deduct balance', async () => {
  const ctx = await resolveLeaveTestContext();

  const created = await leaveAppService.createLeaveRequest({
    hostId: ctx.hostId,
    userId: ctx.userId,
    leaveTypeId: ctx.leaveTypeId,
    fromDate: ctx.fromDate,
    tillDate: ctx.tillDate,
    reason: 'concurrency approval test',
    requestLocalId: createRequestLocalId('leave-concurrency-approval'),
    days: ctx.days,
  });

  const leaveRequestId = asNumber(created?.request?.id);
  assert(leaveRequestId > 0, 'Created request id missing');

  const beforeApprove = await getBalanceSnapshot(ctx);

  const [approveOne, approveTwo] = await Promise.all([
    leaveRequestApprovalService.approveLeaveRequest({
      hostId: ctx.hostId,
      approverUserId: ctx.adminUserId,
      approverRoleId: ctx.adminRoleId,
      leaveRequestId,
      comment: 'approve once',
    }),
    leaveRequestApprovalService.approveLeaveRequest({
      hostId: ctx.hostId,
      approverUserId: ctx.adminUserId,
      approverRoleId: ctx.adminRoleId,
      leaveRequestId,
      comment: 'approve twice race',
    }),
  ]);

  assert.equal(approveOne?.request?.status, 'APPROVED');
  assert.equal(approveTwo?.request?.status, 'APPROVED');

  const afterApprove = await getBalanceSnapshot(ctx);

  assert.equal(
    Number(afterApprove.usedBalance.toFixed(2)),
    Number((beforeApprove.usedBalance + ctx.totalLeaveDays).toFixed(2)),
    'Used balance should be consumed exactly once'
  );

  const history = await leaveRequestApprovalService.viewApprovalHistory({
    hostId: ctx.hostId,
    approverUserId: ctx.adminUserId,
    approverRoleId: ctx.adminRoleId,
    leaveRequestId,
  });

  const approvals = Array.isArray(history?.approvals) ? history.approvals : [];
  const approvedEntries = approvals.filter((a) => a.action === 'APPROVED');
  assert.equal(approvedEntries.length, 1, 'Approval audit should have exactly one APPROVED entry');

  const cancelled = await leaveRequestApprovalService.cancelLeaveRequest({
    hostId: ctx.hostId,
    approverUserId: ctx.adminUserId,
    approverRoleId: ctx.adminRoleId,
    leaveRequestId,
    comment: 'cleanup after concurrency test',
  });

  assert.equal(cancelled?.request?.status, 'CANCELLED');
});
