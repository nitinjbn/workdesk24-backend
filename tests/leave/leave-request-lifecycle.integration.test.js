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

test('leave lifecycle: pending->approve->cancel, pending->reject, pending->withdraw', async () => {
  const ctx = await resolveLeaveTestContext();

  const before = await getBalanceSnapshot(ctx);

  const requestA = await leaveAppService.createLeaveRequest({
    hostId: ctx.hostId,
    userId: ctx.userId,
    leaveTypeId: ctx.leaveTypeId,
    fromDate: ctx.fromDate,
    tillDate: ctx.tillDate,
    reason: 'integration test - request A',
    requestLocalId: createRequestLocalId('leave-lifecycle-a'),
    days: ctx.days,
  });

  const requestAId = asNumber(requestA?.request?.id);
  assert(requestAId > 0, 'Request A id not returned');
  assert.equal(requestA?.request?.status, 'PENDING');

  const afterPendingA = await getBalanceSnapshot(ctx);
  assert.equal(
    Number(afterPendingA.pendingBalance.toFixed(2)),
    Number((before.pendingBalance + ctx.totalLeaveDays).toFixed(2)),
    'Pending balance should increase after create'
  );

  const approvedA = await leaveRequestApprovalService.approveLeaveRequest({
    hostId: ctx.hostId,
    approverUserId: ctx.adminUserId,
    approverRoleId: ctx.adminRoleId,
    leaveRequestId: requestAId,
    comment: 'integration approve A',
  });

  assert.equal(approvedA?.request?.status, 'APPROVED');

  const afterApproveA = await getBalanceSnapshot(ctx);
  assert.equal(
    Number(afterApproveA.pendingBalance.toFixed(2)),
    Number(before.pendingBalance.toFixed(2)),
    'Pending balance should be restored after approval conversion'
  );
  assert.equal(
    Number(afterApproveA.usedBalance.toFixed(2)),
    Number((before.usedBalance + ctx.totalLeaveDays).toFixed(2)),
    'Used balance should increase on approval'
  );

  const cancelledA = await leaveRequestApprovalService.cancelLeaveRequest({
    hostId: ctx.hostId,
    approverUserId: ctx.adminUserId,
    approverRoleId: ctx.adminRoleId,
    leaveRequestId: requestAId,
    comment: 'integration cancel A',
  });

  assert.equal(cancelledA?.request?.status, 'CANCELLED');

  const afterCancelA = await getBalanceSnapshot(ctx);
  assert.equal(
    Number(afterCancelA.usedBalance.toFixed(2)),
    Number(before.usedBalance.toFixed(2)),
    'Used balance should be restored after approved cancellation'
  );

  const requestB = await leaveAppService.createLeaveRequest({
    hostId: ctx.hostId,
    userId: ctx.userId,
    leaveTypeId: ctx.leaveTypeId,
    fromDate: ctx.fromDate,
    tillDate: ctx.tillDate,
    reason: 'integration test - request B',
    requestLocalId: createRequestLocalId('leave-lifecycle-b'),
    days: ctx.days,
  });

  const requestBId = asNumber(requestB?.request?.id);
  assert(requestBId > 0, 'Request B id not returned');
  assert.equal(requestB?.request?.status, 'PENDING');

  const rejectedB = await leaveRequestApprovalService.rejectLeaveRequest({
    hostId: ctx.hostId,
    approverUserId: ctx.adminUserId,
    approverRoleId: ctx.adminRoleId,
    leaveRequestId: requestBId,
    comment: 'integration reject B',
  });

  assert.equal(rejectedB?.request?.status, 'REJECTED');

  const afterRejectB = await getBalanceSnapshot(ctx);
  assert.equal(
    Number(afterRejectB.pendingBalance.toFixed(2)),
    Number(before.pendingBalance.toFixed(2)),
    'Pending balance should be unchanged after reject finalization'
  );

  const requestC = await leaveAppService.createLeaveRequest({
    hostId: ctx.hostId,
    userId: ctx.userId,
    leaveTypeId: ctx.leaveTypeId,
    fromDate: ctx.fromDate,
    tillDate: ctx.tillDate,
    reason: 'integration test - request C',
    requestLocalId: createRequestLocalId('leave-lifecycle-c'),
    days: ctx.days,
  });

  const requestCId = asNumber(requestC?.request?.id);
  assert(requestCId > 0, 'Request C id not returned');

  const withdrawnC = await leaveAppService.withdrawLeaveRequest({
    hostId: ctx.hostId,
    userId: ctx.userId,
    leaveRequestId: requestCId,
  });

  assert.equal(withdrawnC?.request?.status, 'WITHDRAWN');

  const afterWithdrawC = await getBalanceSnapshot(ctx);
  assert.equal(
    Number(afterWithdrawC.pendingBalance.toFixed(2)),
    Number(before.pendingBalance.toFixed(2)),
    'Pending balance should be restored after withdraw'
  );
});
