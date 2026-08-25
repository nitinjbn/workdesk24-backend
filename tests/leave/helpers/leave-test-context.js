require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const leaveAppService = require('../../../src/modules/leave/services/leave-app.service').default;
const leaveBalanceService = require('../../../src/modules/leave/services/leave-balance.service').default;
const leaveCalculationService = require('../../../src/modules/leave/services/leave-calculation.service').default;

function asNumber(value, fallback = 0) {
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function formatYmd(date) {
  return date.toISOString().slice(0, 10);
}

function addDays(fromDate, days) {
  const d = new Date(`${fromDate}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return formatYmd(d);
}

function createRequestLocalId(prefix) {
  return `${prefix}-${Date.now()}-${Math.floor(Math.random() * 1000000)}`;
}

async function findFirstValidSingleDayRequest(params) {
  const { hostId, userId, leaveTypeId, lookAheadDays = 45 } = params;
  const today = formatYmd(new Date());

  for (let offset = 1; offset <= lookAheadDays; offset += 1) {
    const candidateDate = addDays(today, offset);
    const result = await leaveCalculationService.validateAndCalculateLeave({
      hostId,
      userId,
      leaveTypeId,
      fromDate: candidateDate,
      tillDate: candidateDate,
      durationType: 'FULL_DAY',
      days: [
        {
          leaveDate: candidateDate,
          durationType: 'FULL_DAY',
        },
      ],
    });

    if (result.isValid) {
      return {
        fromDate: candidateDate,
        tillDate: candidateDate,
        days: [
          {
            leaveDate: candidateDate,
            durationType: 'FULL_DAY',
          },
        ],
        totalLeaveDays: asNumber(result.totalLeaveDays),
        leaveYearId: asNumber(result.context?.leaveYear?.id),
      };
    }
  }

  throw new Error('No valid leave date found in the next 45 days for test user');
}

async function resolveLeaveTestContext() {
  const hostId = asNumber(process.env.LEAVE_TEST_HOST_ID);
  const userId = asNumber(process.env.LEAVE_TEST_EMPLOYEE_USER_ID);
  const adminUserId = asNumber(process.env.LEAVE_TEST_ADMIN_USER_ID);
  const adminRoleId = asNumber(process.env.LEAVE_TEST_ADMIN_ROLE_ID);

  assert(hostId > 0, 'LEAVE_TEST_HOST_ID is required');
  assert(userId > 0, 'LEAVE_TEST_EMPLOYEE_USER_ID is required');
  assert(adminUserId > 0, 'LEAVE_TEST_ADMIN_USER_ID is required');
  assert(adminRoleId > 0, 'LEAVE_TEST_ADMIN_ROLE_ID is required');

  const leaveTypesResponse = await leaveAppService.getLeaveTypes({ hostId, userId });
  const leaveTypes = Array.isArray(leaveTypesResponse?.leaveTypes) ? leaveTypesResponse.leaveTypes : [];
  assert(leaveTypes.length > 0, 'No leave type configured for test employee');

  const leaveTypeId = asNumber(leaveTypes[0]?.leaveType?.id);
  assert(leaveTypeId > 0, 'Failed to resolve leaveTypeId from getLeaveTypes');

  const window = await findFirstValidSingleDayRequest({ hostId, userId, leaveTypeId });
  assert(window.leaveYearId > 0, 'Failed to resolve leaveYearId from leave calculation context');

  return {
    hostId,
    userId,
    adminUserId,
    adminRoleId,
    leaveTypeId,
    leaveYearId: window.leaveYearId,
    fromDate: window.fromDate,
    tillDate: window.tillDate,
    days: window.days,
    totalLeaveDays: window.totalLeaveDays,
  };
}

async function getBalanceSnapshot({ hostId, userId, leaveTypeId, leaveYearId }) {
  const response = await leaveBalanceService.getBalanceByLeaveType({
    hostId,
    userId,
    leaveTypeId,
    leaveYearId,
  });

  const balances = Array.isArray(response?.balances) ? response.balances : [];
  if (balances.length === 0) {
    return {
      allocatedBalance: 0,
      accruedBalance: 0,
      carriedForwardBalance: 0,
      usedBalance: 0,
      pendingBalance: 0,
      expiredBalance: 0,
      availableBalance: 0,
    };
  }

  const row = balances[0];
  return {
    allocatedBalance: asNumber(row.allocatedBalance),
    accruedBalance: asNumber(row.accruedBalance),
    carriedForwardBalance: asNumber(row.carriedForwardBalance),
    usedBalance: asNumber(row.usedBalance),
    pendingBalance: asNumber(row.pendingBalance),
    expiredBalance: asNumber(row.expiredBalance),
    availableBalance: asNumber(row.availableBalance),
  };
}

module.exports = {
  asNumber,
  createRequestLocalId,
  getBalanceSnapshot,
  resolveLeaveTestContext,
};
