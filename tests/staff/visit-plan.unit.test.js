const test = require('node:test');
const assert = require('node:assert/strict');

const visitPlanService = require('../../src/modules/staff/services/visit-plan.service').default;

test('Visit Plan scheduled date is parsed strictly in host timezone', () => {
  const service = visitPlanService;
  const parsed = service.parseScheduledDate('2026-11-27', 'Asia/Kolkata');
  assert.equal(typeof parsed, 'number');
  assert.ok(parsed > 0);
  assert.throws(() => service.parseScheduledDate('2026-02-30', 'Asia/Kolkata'));
});

test('Visit Plan scheduled time validates 24-hour HH:mm format', () => {
  assert.equal(visitPlanService.validateTime('10:30'), '10:30');
  assert.equal(visitPlanService.validateTime(null), null);
  assert.throws(() => visitPlanService.validateTime('25:30'));
});

test('A same-host customerId takes precedence over a mismatched or invalid local ID', async (t) => {
  const db = require('../../src/models').default;
  const findById = t.mock.method(db.Customer, 'findOne', async () => ({ id: 125, localId: null }));
  const findByLocalId = t.mock.method(db.Customer, 'findAll', async () => []);
  for (const customerLocalId of ['wrong-local-id', 123, null]) {
    const customer = await visitPlanService.resolveCustomer(1, { customerId: 125, customerLocalId });
    assert.equal(customer.id, 125);
  }
  assert.deepEqual(findById.mock.calls[0].arguments[0].where, { id: 125, hostId: 1, isDeleted: 0 });
  assert.equal(findByLocalId.mock.callCount(), 0);
});

test('Local ID resolves a customer when the server ID is absent, invalid or not found', async (t) => {
  const db = require('../../src/models').default;
  const findById = t.mock.method(db.Customer, 'findOne', async () => null);
  const findByLocalId = t.mock.method(db.Customer, 'findAll', async () => [{ id: 125, localId: 'device-id' }]);
  for (const customerId of [undefined, -1, 999]) {
    const customer = await visitPlanService.resolveCustomer(1, { customerId, customerLocalId: ' device-id ' });
    assert.equal(customer.id, 125);
  }
  assert.equal(findById.mock.callCount(), 1);
  assert.deepEqual(findById.mock.calls[0].arguments[0].where, { id: 999, hostId: 1, isDeleted: 0 });
  assert.deepEqual(findByLocalId.mock.calls[0].arguments[0].where, {
    hostId: 1, localId: 'device-id', isDeleted: 0,
  });
  assert.equal(findByLocalId.mock.calls[0].arguments[0].limit, 2);
});

test('Customer resolution rejects missing, malformed, unknown and ambiguous fallbacks', async (t) => {
  const db = require('../../src/models').default;
  t.mock.method(db.Customer, 'findOne', async () => null);
  t.mock.method(db.Customer, 'findAll', async (options) =>
    options.where.localId === 'duplicate' ? [{ id: 1 }, { id: 2 }] : []
  );
  await assert.rejects(visitPlanService.resolveCustomer(1, {}), { statusCode: 400 });
  await assert.rejects(visitPlanService.resolveCustomer(1, { customerId: -1 }), { statusCode: 400 });
  await assert.rejects(visitPlanService.resolveCustomer(1, { customerId: 999, customerLocalId: 123 }), { statusCode: 400 });
  await assert.rejects(visitPlanService.resolveCustomer(1, { customerId: 999 }), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
  await assert.rejects(visitPlanService.resolveCustomer(1, { customerLocalId: 'unknown' }), { statusCode: 404, code: 'CUSTOMER_NOT_FOUND' });
  await assert.rejects(visitPlanService.resolveCustomer(1, { customerLocalId: 'duplicate' }), { statusCode: 409, code: 'CUSTOMER_LOCAL_ID_AMBIGUOUS' });
});

test('Visit Plan application access allows every authenticated app user', () => {
  assert.doesNotThrow(() =>
    visitPlanService.requireAppAccess({ id: 9, hostId: 1, isAdminUser: 0, isFieldAppUser: 0 })
  );
});

test('Visit Plan application access allows admin and field-app users', () => {
  assert.doesNotThrow(() =>
    visitPlanService.requireAppAccess({ id: 1, hostId: 1, isAdminUser: 1, isFieldAppUser: 0 })
  );
  assert.doesNotThrow(() =>
    visitPlanService.requireAppAccess({ id: 2, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 })
  );
});

test('Ambiguous implicit check-in does not update or create history', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const HostSettings = require('../../src/models').HostSettings;
  const originals = {
    findEligibleForCheckIn: repository.findEligibleForCheckIn,
    updateVisit: repository.updateVisit,
    historyCreate: repository.historyCreate,
    hostSettingsFindAll: HostSettings.findAll,
  };
  let updates = 0;
  let histories = 0;
  repository.findEligibleForCheckIn = async () => [{ id: 501 }, { id: 502 }];
  repository.updateVisit = async () => { updates += 1; };
  repository.historyCreate = async () => { histories += 1; };
  HostSettings.findAll = async () => [];
  try {
    await visitPlanService.onExistingVisitCheckIn(
      1,
      { id: 700, customerId: 125, userId: 42, checkInTime: 1795795200 },
      42,
      {}
    );
    assert.equal(updates, 0);
    assert.equal(histories, 0);
  } finally {
    Object.assign(repository, originals);
    const HostSettings = require('../../src/models').HostSettings;
    HostSettings.findAll = originals.hostSettingsFindAll;
  }
});

test('Explicit check-in rejects a plan linked to another customer or officer', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const originalFind = repository.findById;
  const originalUpdate = repository.updateVisit;
  let updates = 0;
  repository.findById = async () => ({
    id: 501,
    customerId: 126,
    assignedUserId: 42,
    status: 'SCHEDULED',
  });
  repository.updateVisit = async () => { updates += 1; };
  try {
    await visitPlanService.onExistingVisitCheckIn(
      1,
      { id: 700, customerId: 125, userId: 42, checkInTime: 1795795200, plannedVisitId: 501 },
      42,
      {}
    );
    assert.equal(updates, 0);
  } finally {
    repository.findById = originalFind;
    repository.updateVisit = originalUpdate;
  }
});

test('Completion retry with an already completed plan does not add duplicate history', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const db = require('../../src/models').default;
  const originalFindLinked = repository.findCheckInLinkedPlan;
  const originalHistory = db.VisitPlanHistory.findOne;
  const originalUpdate = repository.updateVisit;
  const originalHistoryCreate = repository.historyCreate;
  let updates = 0;
  let histories = 0;
  repository.findCheckInLinkedPlan = async () => ({
    id: 501,
    customerId: 125,
    status: 'COMPLETED',
  });
  repository.updateVisit = async () => { updates += 1; };
  repository.historyCreate = async () => { histories += 1; };
  db.VisitPlanHistory.findOne = async () => ({ id: 900 });
  try {
    await visitPlanService.onExistingVisitCompletion(
      1,
      { id: 700, checkOutTime: 1795802400 },
      42,
      {}
    );
    assert.equal(updates, 0);
    assert.equal(histories, 0);
  } finally {
    repository.findCheckInLinkedPlan = originalFindLinked;
    repository.updateVisit = originalUpdate;
    repository.historyCreate = originalHistoryCreate;
    db.VisitPlanHistory.findOne = originalHistory;
  }
});

test('Visit Plan migration includes tenant and referential integrity constraints', () => {
  const fs = require('node:fs');
  const migration = fs.readFileSync(
    'src/migrations/20261126151530-create-visit-plan-tables.js',
    'utf8'
  );
  assert.match(migration, /model: 'wd_hosts'/);
  assert.match(migration, /model: 'wd_customers'/);
  assert.match(migration, /model: 'wd_users'/);
  assert.match(migration, /model: 'wd_visits'/);
  assert.match(migration, /onDelete: 'RESTRICT'/);
});

test('Every authenticated app user passes Visit Plan access validation', () => {
  assert.doesNotThrow(() =>
    visitPlanService.requireAppAccess({ id: 9, hostId: 1, isAdminUser: 0, isFieldAppUser: 0 })
  );
  assert.doesNotThrow(() =>
    visitPlanService.requireAppAccess({ id: 10, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 })
  );
  assert.doesNotThrow(() =>
    visitPlanService.requireAppAccess({ id: 11, hostId: 1, isAdminUser: 1, isFieldAppUser: 0 })
  );
});

test('Field officer cannot access a customer assigned only to another user', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const originalUser = repository.findUser;
  const originalAssignments = repository.findCustomerAssignments;
  repository.findUser = async () => ({
    id: 42,
    hostId: 1,
    isDeleted: 0,
    accountStatus: 'ACTIVE',
    isFieldAppUser: 1,
  });
  repository.findCustomerAssignments = async () => [{ userId: 43 }];
  try {
    await assert.rejects(
      () =>
        visitPlanService.validateAssignedUser(
          1,
          42,
          { id: 42, hostId: 1, isFieldAppUser: 1, isAdminUser: 0 },
          125,
          {}
        ),
      (error) => error.statusCode === 403
    );
  } finally {
    repository.findUser = originalUser;
    repository.findCustomerAssignments = originalAssignments;
  }
});

test('Field officer can assign a visit to another eligible same-host employee', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const originalUser = repository.findUser;
  const originalAssignments = repository.findCustomerAssignments;
  repository.findUser = async (_hostId, userId) => ({
    id: userId,
    hostId: 1,
    isDeleted: 0,
    accountStatus: 'ACTIVE',
    isFieldAppUser: 1,
  });
  repository.findCustomerAssignments = async () => [{ userId: 42 }];
  try {
    const resolved = await visitPlanService.validateAssignedUser(
      1,
      43,
      { id: 42, hostId: 1, isFieldAppUser: 1, isAdminUser: 0 },
      125,
      {}
    );
    assert.equal(resolved, 43);
  } finally {
    repository.findUser = originalUser;
    repository.findCustomerAssignments = originalAssignments;
  }
});

test('Field officer can schedule for an assigned customer', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const originalUser = repository.findUser;
  const originalAssignments = repository.findCustomerAssignments;
  repository.findUser = async () => ({
    id: 42,
    hostId: 1,
    isDeleted: 0,
    accountStatus: 'ACTIVE',
    isFieldAppUser: 1,
  });
  repository.findCustomerAssignments = async () => [{ userId: 42 }];
  try {
    const resolved = await visitPlanService.validateAssignedUser(
      1,
      42,
      { id: 42, hostId: 1, isFieldAppUser: 1, isAdminUser: 0 },
      125,
      {}
    );
    assert.equal(resolved, 42);
  } finally {
    repository.findUser = originalUser;
    repository.findCustomerAssignments = originalAssignments;
  }
});

test('Admin can schedule for a customer and assign a same-host field officer', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const originalUser = repository.findUser;
  const originalAssignments = repository.findCustomerAssignments;
  repository.findUser = async (_hostId, userId) => ({
    id: userId,
    hostId: 1,
    isDeleted: 0,
    accountStatus: 'ACTIVE',
    isFieldAppUser: 1,
  });
  repository.findCustomerAssignments = async () => [];
  try {
    const resolved = await visitPlanService.validateAssignedUser(
      1,
      42,
      { id: 1, hostId: 1, isFieldAppUser: 0, isAdminUser: 1 },
      125,
      {}
    );
    assert.equal(resolved, 42);
  } finally {
    repository.findUser = originalUser;
    repository.findCustomerAssignments = originalAssignments;
  }
});

test('Cross-host assigned employee is rejected', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const originalUser = repository.findUser;
  repository.findUser = async () => null;
  try {
    await assert.rejects(
      () =>
        visitPlanService.validateAssignedUser(
          1,
          43,
          { id: 1, hostId: 1, isFieldAppUser: 0, isAdminUser: 1 },
          125,
          {}
        ),
      (error) => error.statusCode === 400
    );
  } finally {
    repository.findUser = originalUser;
  }
});

test('Inactive, deleted, or app-disabled employee is rejected', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const originalUser = repository.findUser;
  repository.findUser = async () => ({
    id: 43,
    hostId: 1,
    isDeleted: 0,
    accountStatus: 'INACTIVE',
    isFieldAppUser: 1,
  });
  try {
    await assert.rejects(
      () =>
        visitPlanService.validateAssignedUser(
          1,
          43,
          { id: 1, hostId: 1, isFieldAppUser: 0, isAdminUser: 1 },
          125,
          {}
        ),
      (error) => error.statusCode === 400
    );
  } finally {
    repository.findUser = originalUser;
  }
});

test('Overdue boundary helpers derive date-only and timed deadlines', () => {
  const zone = 'Asia/Kolkata';
  const today = visitPlanService.parseScheduledDate('2026-11-26', zone);
  const yesterday = visitPlanService.parseScheduledDate('2026-11-25', zone);

  assert.ok(yesterday < today);
  assert.equal(
    visitPlanService.isOverdue({
      scheduledDate: yesterday,
      scheduledTime: null,
      status: 'SCHEDULED',
    }, today + 86400, 'Asia/Kolkata'),
    true
  );
  assert.equal(
    visitPlanService.isOverdue({
      scheduledDate: today,
      scheduledTime: null,
      status: 'IN_PROGRESS',
    }, today + 86399, 'Asia/Kolkata'),
    false
  );
  assert.equal(
    visitPlanService.isOverdue({
      scheduledDate: today,
      scheduledTime: '10:30',
      status: 'SCHEDULED',
    }, today + (10 * 3600) + (29 * 60), 'Asia/Kolkata'),
    false
  );
  assert.equal(
    visitPlanService.isOverdue({
      scheduledDate: today,
      scheduledTime: '10:30',
      status: 'IN_PROGRESS',
    }, today + (10 * 3600) + (31 * 60), 'Asia/Kolkata'),
    true
  );
  assert.equal(
    visitPlanService.isOverdue({
      scheduledDate: yesterday,
      scheduledTime: '10:30',
      status: 'COMPLETED',
    }, today + 86400, 'Asia/Kolkata'),
    false
  );
});

test('Today response exposes visits and preserves pagination and timezone', async (t) => {
  const db = require('../../src/models').default;
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const controller = require('../../src/modules/staff/controllers/visit-plan.controller').default;
  t.mock.method(db.HostSettings, 'findAll', async () => []);
  const findAndCount = t.mock.method(repository, 'findAndCount', async () => ({
    rows: [{ toJSON: () => ({ id: 5, assignedUserId: 42, status: 'SCHEDULED' }) }],
    count: 1,
  }));
  const request = { user: { id: 42, hostId: 1, isFieldAppUser: 1 }, body: { page: 1, limit: 20 } };
  let response;
  const res = { json: (payload) => { response = payload; } };
  const next = (error) => { throw error; };

  await controller.today(request, res, next);
  assert.equal(response.success, true);
  assert.equal(response.message, 'Today visits retrieved successfully');
  assert.equal(response.data.visits.length, 1);
  assert.equal(response.data.visits[0].id, 5);
  assert.equal(response.data.visits[0].overdue, false);
  assert.equal(response.data.visits[0].hostTimeZone, response.data.hostTimeZone);
  assert.deepEqual(response.data.pagination, { total: 1, page: 1, limit: 20, totalPages: 1 });
  assert.equal('data' in response.data, false);

  findAndCount.mock.mockImplementation(async () => ({ rows: [], count: 0 }));
  await controller.today(request, res, next);
  assert.deepEqual(response.data.visits, []);
  assert.equal(response.data.pagination.total, 0);
});

test('Today formats visit dates and timestamps using host settings without changing other fields', async (t) => {
  const db = require('../../src/models').default;
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const controller = require('../../src/modules/staff/controllers/visit-plan.controller').default;
  t.mock.method(db.HostSettings, 'findAll', async () => [
    { settingName: 'timezone', settingValue: 'America/New_York' },
    { settingName: 'dateFormat', settingValue: 'YYYY/MM/DD' },
    { settingName: 'dateTimeFormat', settingValue: 'YYYY/MM/DD HH:mm' },
  ]);
  t.mock.method(repository, 'findAndCount', async () => ({
    rows: [{ toJSON: () => ({
      id: 5,
      assignedUserId: '42',
      scheduledDate: '1795669200',
      scheduledTime: '10:30',
      checkInAt: '1795673700',
      completedAt: null,
      createdAt: 1795673700,
      updatedAt: null,
    }) }],
    count: 1,
  }));
  let response;
  await controller.today(
    { user: { id: 42, hostId: 1, isFieldAppUser: 1 }, body: {} },
    { json: (payload) => { response = payload; } },
    (error) => { throw error; }
  );
  const visit = response.data.visits[0];
  assert.equal(visit.scheduledDate, '2026/11/26');
  assert.equal(visit.createdAt, '2026/11/26 01:15');
  assert.equal(visit.checkInAt, '2026/11/26 01:15');
  assert.equal(visit.updatedAt, null);
  assert.equal(visit.completedAt, null);
  assert.equal(visit.scheduledTime, '10:30');
  assert.equal(visit.assignedUserId, '42');
  assert.equal(response.data.hostTimeZone, 'America/New_York');
});

test('Upcoming and overdue responses use visits and host-formatted dates', async (t) => {
  const db = require('../../src/models').default;
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const controller = require('../../src/modules/staff/controllers/visit-plan.controller').default;
  t.mock.method(db.HostSettings, 'findAll', async () => [
    { settingName: 'timezone', settingValue: 'America/New_York' },
    { settingName: 'dateFormat', settingValue: 'YYYY/MM/DD' },
    { settingName: 'dateTimeFormat', settingValue: 'YYYY/MM/DD HH:mm' },
  ]);
  t.mock.method(repository, 'findAndCount', async () => ({
    rows: [{ toJSON: () => ({ id: 5, scheduledDate: '1795669200', createdAt: 1795673700 }) }],
    count: 1,
  }));
  let response;
  for (const endpoint of ['upcoming', 'overdue']) {
    await controller[endpoint](
      { user: { id: 42, hostId: 1, isFieldAppUser: 1 }, body: {} },
      { json: (payload) => { response = payload; } },
      (error) => { throw error; }
    );
    assert.equal(response.data.visits[0].scheduledDate, '2026/11/26');
    assert.equal(response.data.visits[0].createdAt, '2026/11/26 01:15');
    assert.equal(response.data.visits[0].overdue, endpoint === 'overdue');
    assert.equal('data' in response.data, false);
  }
});

test('Empty upcoming and overdue responses retain visits and pagination', async (t) => {
  const db = require('../../src/models').default;
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const controller = require('../../src/modules/staff/controllers/visit-plan.controller').default;
  t.mock.method(db.HostSettings, 'findAll', async () => []);
  t.mock.method(repository, 'findAndCount', async () => ({ rows: [], count: 0 }));
  for (const endpoint of ['upcoming', 'overdue']) {
    let response;
    await controller[endpoint](
      { user: { id: 42, hostId: 1, isFieldAppUser: 1 }, body: { page: 2, limit: 10 } },
      { json: (payload) => { response = payload; } },
      (error) => { throw error; }
    );
    assert.deepEqual(response.data.visits, []);
    assert.deepEqual(response.data.pagination, { total: 0, page: 2, limit: 10, totalPages: 0 });
  }
});

test('Visit sorting expression puts timed visits before date-only visits deterministically', () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(
    'src/modules/staff/services/visit-plan.service.ts',
    'utf8'
  );
  assert.match(source, /CASE WHEN scheduledTime IS NULL THEN 1 ELSE 0 END/);
  assert.match(source, /'scheduledDate', 'ASC'/);
  assert.match(source, /'scheduledTime', 'ASC'/);
  assert.match(source, /'createdAt', 'ASC'/);
  assert.match(source, /'id', 'ASC'/);
});

test('Other app users follow existing customer assignment visibility', async () => {
  const repository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const originalAssignments = repository.findCustomerAssignments;
  repository.findCustomerAssignments = async () => [{ userId: 43 }];
  try {
    await assert.rejects(
      () =>
        visitPlanService.ensureCustomerAccessible(
          { id: 42, hostId: 1, isFieldAppUser: 0, isAdminUser: 0 },
          125
        ),
      (error) => error.statusCode === 403
    );
  } finally {
    repository.findCustomerAssignments = originalAssignments;
  }
});

test('Reschedule retains creator and records the acting user', async () => {
  const fs = require('node:fs');
  const source = fs.readFileSync(
    'src/modules/staff/services/visit-plan.service.ts',
    'utf8'
  );
  assert.match(source, /createdBy: user\.id/);
  assert.match(source, /performedBy: user\.id/);
  assert.doesNotMatch(source, /createdBy:\s*plan\.assignedUserId/);
});

test('Assigned field employee is used for list visibility', () => {
  const source = require('node:fs').readFileSync(
    'src/modules/staff/services/visit-plan.service.ts',
    'utf8'
  );
  assert.match(source, /where\.assignedUserId = user\.id/);
  assert.match(source, /createdBy: user\.id/);
  assert.match(source, /assignedUserId/);
});

function assignmentFixture(t, initialAssignments = [42, 7, 8], hostSettings = []) {
  const db = require('../../src/models').default;
  const plans = require('../../src/modules/staff/repositories/visit-plan.repository').default;
  const customers = require('../../src/modules/master/repositories/customer.repository').default;
  let state = {
    assignments: [...initialAssignments],
    plans: [],
    history: [],
  };
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(db.sequelize, 'transaction', async (callback) => {
    const staged = structuredClone(state);
    transaction.state = staged;
    transaction.customerLocked = false;
    const result = await callback(transaction);
    state = staged;
    return result;
  });
  t.mock.method(db.HostSettings, 'findAll', async () => hostSettings);
  t.mock.method(plans, 'resolveCustomer', async (hostId, customerId) =>
    hostId === 1 && customerId === 125
      ? { id: 125, localId: 'customer-125', toJSON: () => ({ id: 125, localId: 'customer-125' }) }
      : null
  );
  t.mock.method(plans, 'findCustomerAssignments', async (_hostId, _customerId, tx, lock) => {
    if (lock) assert.equal(tx.customerLocked, true);
    return (tx ? tx.state : state).assignments.map((userId) => ({ userId }));
  });
  t.mock.method(plans, 'findUser', async (hostId, userId) =>
    hostId === 1 && [42, 43].includes(userId)
      ? { id: userId, hostId: 1, isDeleted: 0, accountStatus: 'ACTIVE', isFieldAppUser: 1 }
      : null
  );
  t.mock.method(plans, 'findDuplicate', async () => null);
  t.mock.method(plans, 'create', async (payload, tx) => {
    const plan = { ...payload, id: 501 };
    tx.state.plans.push(plan);
    return { ...plan, toJSON: () => ({ ...plan }) };
  });
  t.mock.method(plans, 'historyCreate', async (payload, tx) => {
    tx.state.history.push({ ...payload });
  });
  t.mock.method(plans, 'findById', async (hostId, visitId, tx) => {
    const plan = tx.state.plans.find((row) => row.hostId === hostId && row.id === visitId);
    return plan && Object.assign(plan, { toJSON: () => ({ ...plan, toJSON: undefined }) });
  });
  t.mock.method(plans, 'updateVisit', async (plan, payload) => Object.assign(plan, payload));
  t.mock.method(customers, 'lockCustomerForAssignment', async (hostId, customerId, tx) => {
    assert.equal(tx, transaction);
    tx.customerLocked = true;
    return hostId === 1 && customerId === 125 ? { id: customerId } : null;
  });
  t.mock.method(customers, 'getCustomerUserAssignments', async (_payload, tx) => {
    assert.equal(tx, transaction);
    return tx.state.assignments.map((userId) => ({ userId }));
  });
  t.mock.method(customers, 'saveCustomerUserAssignments', async (payload, tx) => {
    assert.equal(tx, transaction);
    tx.state.assignments.push(...payload.userIds);
  });
  return { plans, getState: () => state };
}

const assignmentAdmin = { id: 7, hostId: 1, isAdminUser: 1, isFieldAppUser: 0 };
const scheduleInput = {
  customerId: 125,
  customerLocalId: 'customer-125',
  assignedUserId: 43,
  scheduledDate: '2026-11-27',
};

const newYorkSettings = [
  { settingName: 'timezone', settingValue: 'America/New_York' },
  { settingName: 'dateFormat', settingValue: 'YYYY/MM/DD' },
  { settingName: 'dateTimeFormat', settingValue: 'YYYY/MM/DD HH:mm' },
];

test('Schedule and reschedule format response copies without changing stored timestamps', async (t) => {
  const fixture = assignmentFixture(t, [42, 7, 8], newYorkSettings);
  const scheduled = await visitPlanService.schedule(assignmentAdmin, { ...scheduleInput, scheduledTime: '10:30' });
  assert.equal(scheduled.scheduledDate, '2026/11/27');
  assert.equal(scheduled.scheduledTime, '10:30');
  assert.match(scheduled.createdAt, /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  assert.equal(typeof fixture.getState().plans[0].scheduledDate, 'number');
  assert.equal(typeof fixture.getState().plans[0].createdAt, 'number');

  const rescheduled = await visitPlanService.reschedule(
    assignmentAdmin,
    { visitId: 501, scheduledDate: '2026-11-28', remarks: 'Moved' }
  );
  assert.equal(rescheduled.scheduledDate, '2026/11/28');
  assert.equal(rescheduled.scheduledTime, null);
  assert.equal(rescheduled.createdBy, 7);
  assert.equal(typeof fixture.getState().plans[0].scheduledDate, 'number');
  assert.equal(typeof fixture.getState().history[1].oldScheduledDate, 'number');
});

test('Cancel formats timestamps while stored visit and history remain numeric', async (t) => {
  const fixture = assignmentFixture(t, [42, 7, 8], newYorkSettings);
  await visitPlanService.schedule(assignmentAdmin, scheduleInput);
  const cancelled = await visitPlanService.cancel(assignmentAdmin, { visitId: 501, remarks: 'Cancelled' });
  assert.equal(cancelled.scheduledDate, '2026/11/27');
  assert.match(cancelled.cancelledAt, /^\d{4}\/\d{2}\/\d{2} \d{2}:\d{2}$/);
  assert.equal(typeof fixture.getState().plans[0].cancelledAt, 'number');
  assert.equal(typeof fixture.getState().history[1].eventAt, 'number');
});

test('Both idempotent schedule retry paths return formatted timestamps', async (t) => {
  const fixture = assignmentFixture(t, [42, 7, 8], newYorkSettings);
  const existing = {
    customerId: 125,
    toJSON: () => ({ id: 501, customerId: 125, scheduledDate: '1795669200', createdAt: 1795673700 }),
  };
  let lookupCount = 0;
  let conflict = false;
  t.mock.method(fixture.plans, 'findIdempotent', async () => {
    lookupCount += 1;
    return conflict && lookupCount === 1 ? null : existing;
  });
  t.mock.method(fixture.plans, 'create', async () => {
    throw new (require('sequelize').UniqueConstraintError)();
  });
  for (conflict of [false, true]) {
    lookupCount = 0;
    const body = conflict ? { ...scheduleInput, idempotencyKey: 'key' } : { idempotencyKey: 'key' };
    const response = await visitPlanService.schedule(assignmentAdmin, body);
    assert.equal(response.scheduledDate, '2026/11/26');
    assert.equal(response.createdAt, '2026/11/26 01:15');
    assert.equal(lookupCount, conflict ? 2 : 1);
  }
  assert.deepEqual(fixture.getState().plans, []);
});

test('Customer history formats nested events and returns visits with pagination', async (t) => {
  const fixture = assignmentFixture(t, [42, 7, 8], newYorkSettings);
  t.mock.method(fixture.plans, 'resolveCustomer', async () => ({
    id: 125,
    localId: 'customer-125',
    toJSON: () => ({ id: 125, createdAt: 1795673700 }),
  }));
  const rawVisit = { id: 501, scheduledDate: '1795669200', scheduledTime: '10:30', createdAt: 1795673700 };
  const rawEvent = {
    visitId: 501,
    oldScheduledDate: '1795669200',
    newScheduledDate: 1795755600,
    oldScheduledTime: '10:30',
    newScheduledTime: null,
    eventAt: '1795673700',
  };
  t.mock.method(fixture.plans, 'findAndCount', async () => ({
    rows: [{ toJSON: () => ({ ...rawVisit }) }],
    count: 1,
  }));
  t.mock.method(fixture.plans, 'getHistoryForVisitIds', async () => [{
    visitId: 501,
    toJSON: () => ({ ...rawEvent }),
  }]);
  const result = await visitPlanService.customerHistory(assignmentAdmin, { customerId: 125, page: 1, limit: 10 });
  assert.equal(result.customer.id, 125);
  assert.equal(result.customer.createdAt, '2026/11/26 01:15');
  assert.equal(result.visits[0].scheduledDate, '2026/11/26');
  assert.equal(result.visits[0].history[0].oldScheduledDate, '2026/11/26');
  assert.equal(result.visits[0].history[0].newScheduledDate, '2026/11/27');
  assert.equal(result.visits[0].history[0].eventAt, '2026/11/26 01:15');
  assert.equal(result.visits[0].history[0].oldScheduledTime, '10:30');
  assert.equal(result.visits[0].history[0].newScheduledTime, null);
  assert.deepEqual(result.pagination, { total: 1, page: 1, limit: 10, totalPages: 1 });
  assert.equal('data' in result, false);
  assert.equal(rawVisit.scheduledDate, '1795669200');
  assert.equal(rawEvent.eventAt, '1795673700');
});

test('Details formats the visit, linked check-in and event history', async (t) => {
  const fixture = assignmentFixture(t, [42, 7, 8], newYorkSettings);
  const plan = {
    id: 501, customerId: 125, assignedUserId: 42, checkInVisitId: 800,
    toJSON: () => ({ id: 501, scheduledDate: '1795669200' }),
  };
  t.mock.method(fixture.plans, 'findById', async () => plan);
  t.mock.method(fixture.plans, 'findAndCount', async () => ({
    rows: [{ toJSON: () => ({ id: 501, scheduledDate: '1795669200', customer: { id: 125 }, assignedUser: { id: 42 } }) }],
    count: 1,
  }));
  t.mock.method(fixture.plans, 'getHistory', async () => [{
    toJSON: () => ({ eventAt: 1795673700, oldScheduledDate: '1795669200', newScheduledDate: null }),
  }]);
  t.mock.method(fixture.plans, 'findCheckInVisit', async () => ({
    toJSON: () => ({ id: 800, checkInTime: '1795673700', checkOutTime: null, checkInLatitude: '28.61000000' }),
  }));
  const result = await visitPlanService.details(assignmentAdmin, { visitId: 501 });
  assert.equal(result.visit.scheduledDate, '2026/11/26');
  assert.equal(result.history[0].eventAt, '2026/11/26 01:15');
  assert.equal(result.history[0].oldScheduledDate, '2026/11/26');
  assert.equal(result.history[0].newScheduledDate, null);
  assert.equal(result.checkInVisit.checkInTime, '2026/11/26 01:15');
  assert.equal(result.checkInVisit.checkOutTime, null);
  assert.equal(result.checkInVisit.checkInLatitude, '28.61000000');
  assert.equal(result.customer.id, 125);
  assert.equal(result.assignedUser.id, 42);
});

test('Details allows the assigned field officer when the stored assignee ID is a string', async (t) => {
  const fixture = assignmentFixture(t, [42, 43]);
  const controller = require('../../src/modules/staff/controllers/visit-plan.controller').default;
  const plan = {
    id: 501, hostId: 1, customerId: 125, assignedUserId: '43',
    toJSON: () => ({ id: 501, assignedUserId: '43' }),
  };
  t.mock.method(fixture.plans, 'findById', async (hostId, visitId) =>
    hostId === 1 && visitId === 501 ? plan : null
  );
  t.mock.method(fixture.plans, 'findAndCount', async () => ({ rows: [], count: 0 }));
  t.mock.method(fixture.plans, 'getHistory', async () => []);
  const officer = { id: 43, hostId: 1, isFieldAppUser: 1 };
  let response;
  await controller.details(
    { user: officer, body: { visitId: 501 } },
    { json: (payload) => { response = payload; } },
    (error) => { throw error; }
  );
  assert.equal(response.data.visit.assignedUserId, '43');
  plan.assignedUserId = 43;
  assert.equal((await visitPlanService.details(officer, { visitId: 501 })).visit.id, 501);
  plan.assignedUserId = '43';
  await assert.rejects(visitPlanService.details({ ...officer, id: 42 }, { visitId: 501 }), { statusCode: 403 });
  await assert.rejects(visitPlanService.details({ ...officer, hostId: 2 }, { visitId: 501 }), { statusCode: 404 });
  plan.assignedUserId = '43invalid';
  await assert.rejects(visitPlanService.details(officer, { visitId: 501 }), { statusCode: 403 });
  plan.assignedUserId = '43';
  fixture.getState().assignments.splice(1, 1);
  await assert.rejects(visitPlanService.details(officer, { visitId: 501 }), {
    statusCode: 403,
    code: 'CUSTOMER_NOT_ASSIGNED_TO_FIELD_OFFICER',
  });
});

test('Cancel allows only the assigned field officer when the stored assignee ID is a string', async (t) => {
  const fixture = assignmentFixture(t);
  await visitPlanService.schedule(assignmentAdmin, scheduleInput);
  fixture.getState().plans[0].assignedUserId = '43';
  const officer = { id: 43, hostId: 1, isFieldAppUser: 1 };
  const body = { visitId: 501, remarks: 'Cancelled' };
  await assert.rejects(visitPlanService.cancel({ ...officer, id: 42 }, body), { statusCode: 403 });
  await assert.rejects(visitPlanService.cancel({ ...officer, hostId: 2 }, body), { statusCode: 404 });
  fixture.getState().assignments = [42, 7, 8];
  await assert.rejects(visitPlanService.cancel(officer, body), { statusCode: 403 });
  fixture.getState().assignments.push(43);
  const result = await visitPlanService.cancel(officer, body);
  assert.equal(result.status, 'CANCELLED');
  assert.equal(fixture.getState().history[1].performedBy, 43);
});

test('Open customer remains open after scheduling, reassignment, and history access', async (t) => {
  const fixture = assignmentFixture(t, []);
  const scheduler = { id: 42, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 };
  const assignee = { ...scheduler, id: 43 };
  const other = { ...scheduler, id: 44 };
  t.mock.method(fixture.plans, 'findAndCount', async () => ({ rows: [], count: 0 }));
  t.mock.method(fixture.plans, 'getHistoryForVisitIds', async () => []);

  await visitPlanService.schedule(scheduler, scheduleInput);
  assert.deepEqual(fixture.getState().assignments, []);
  await visitPlanService.customerHistory(other, { customerId: 125 });
  await visitPlanService.reschedule(
    assignee,
    { visitId: 501, assignedUserId: 42, scheduledDate: '2026-11-28', remarks: 'Moved' }
  );
  assert.deepEqual(fixture.getState().assignments, []);
  assert.equal(fixture.getState().plans[0].assignedUserId, 42);
  assert.equal(fixture.getState().plans[0].createdBy, 42);
  assert.equal(fixture.getState().history[1].performedBy, 43);
  await visitPlanService.customerHistory(other, { customerId: 125 });
});

test('A field officer assigned to the customer can reschedule another employee visit', async (t) => {
  const fixture = assignmentFixture(t);
  const scheduler = { id: 42, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 };
  await visitPlanService.schedule(scheduler, scheduleInput);

  await visitPlanService.reschedule(
    scheduler,
    { visitId: 501, scheduledDate: '2026-11-28', remarks: 'Moved' }
  );

  const state = fixture.getState();
  assert.equal(state.plans[0].assignedUserId, 43);
  assert.equal(state.plans[0].createdBy, 42);
  assert.equal(state.history[1].performedBy, 42);
  assert.deepEqual(state.assignments, [42, 7, 8, 43]);
});

test('Any field officer can reschedule a visit for an open customer', async (t) => {
  const fixture = assignmentFixture(t, []);
  await visitPlanService.schedule(
    { id: 42, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 },
    scheduleInput
  );
  await visitPlanService.reschedule(
    { id: 44, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 },
    { visitId: 501, scheduledDate: '2026-11-28', remarks: 'Moved' }
  );
  assert.deepEqual(fixture.getState().assignments, []);
  assert.equal(fixture.getState().history[1].performedBy, 44);
});

test('Rescheduling rejects an unassigned field officer and a different host', async (t) => {
  const fixture = assignmentFixture(t);
  await visitPlanService.schedule(assignmentAdmin, scheduleInput);
  const body = { visitId: 501, scheduledDate: '2026-11-28', remarks: 'Moved' };
  await assert.rejects(
    visitPlanService.reschedule({ id: 44, hostId: 1, isFieldAppUser: 1 }, body),
    { statusCode: 403 }
  );
  await assert.rejects(
    visitPlanService.reschedule({ id: 42, hostId: 2, isFieldAppUser: 1 }, body),
    { statusCode: 404 }
  );
  assert.equal(fixture.getState().history.length, 1);
});

test('Restricted customers deny unassigned users, including admins, across visit operations', async (t) => {
  const fixture = assignmentFixture(t);
  const other = { id: 44, hostId: 1, isAdminUser: 0, isFieldAppUser: 0 };
  const unassignedAdmin = { ...other, isAdminUser: 1 };
  await visitPlanService.schedule(assignmentAdmin, { ...scheduleInput, assignedUserId: 42 });
  for (const user of [other, unassignedAdmin]) {
    await assert.rejects(visitPlanService.schedule(user, scheduleInput), { statusCode: 403 });
    await assert.rejects(visitPlanService.customerHistory(user, { customerId: 125 }), { statusCode: 403 });
    await assert.rejects(
      visitPlanService.reschedule(user, { visitId: 501, scheduledDate: '2026-11-28', remarks: 'Moved' }),
      { statusCode: 403 }
    );
  }
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
  assert.equal(fixture.getState().history.length, 1);
});

test('An idempotent schedule retry checks the caller can still access the customer', async (t) => {
  const fixture = assignmentFixture(t);
  const plan = { id: 501, customerId: 125, toJSON: () => ({ id: 501, customerId: 125 }) };
  t.mock.method(fixture.plans, 'findIdempotent', async () => plan);
  const body = { idempotencyKey: 'existing-key' };

  await assert.rejects(
    visitPlanService.schedule({ id: 44, hostId: 1, isAdminUser: 1 }, body),
    { statusCode: 403 }
  );
  assert.deepEqual(await visitPlanService.schedule(assignmentAdmin, body), { id: 501, customerId: 125 });
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
});

test('Schedule and customer history use the same local ID fallback', async (t) => {
  const fixture = assignmentFixture(t);
  const findByLocalId = t.mock.method(fixture.plans, 'findCustomersByLocalId', async (hostId, localId) => {
    assert.equal(hostId, 1);
    assert.equal(localId, 'customer-125');
    return [{ id: 125, localId, toJSON: () => ({ id: 125, localId }) }];
  });
  t.mock.method(fixture.plans, 'findAndCount', async () => ({ rows: [], count: 0 }));
  t.mock.method(fixture.plans, 'getHistoryForVisitIds', async () => []);
  await visitPlanService.schedule(assignmentAdmin, { ...scheduleInput, customerId: 999 });
  const history = await visitPlanService.customerHistory(
    assignmentAdmin,
    { customerId: 999, customerLocalId: 'customer-125' }
  );
  assert.equal(fixture.getState().plans[0].customerId, 125);
  assert.equal(history.customer.id, 125);
  assert.deepEqual(history.visits, []);
  assert.equal(findByLocalId.mock.callCount(), 2);
});

test('Scheduling adds the assignee, retains prior assignments, and records the creator', async (t) => {
  const fixture = assignmentFixture(t);
  await visitPlanService.schedule(assignmentAdmin, scheduleInput);
  const state = fixture.getState();
  assert.deepEqual(state.assignments, [42, 7, 8, 43]);
  assert.equal(state.plans[0].assignedUserId, 43);
  assert.equal(state.plans[0].createdBy, 7);
  assert.equal(state.history[0].performedBy, 7);
  const officer = { id: 43, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 };
  await visitPlanService.ensureCustomerAccessible(officer, 125, { state });
  await visitPlanService.ensureCustomerAccessible({ ...officer, id: 42 }, 125, { state });
  await assert.rejects(
    visitPlanService.ensureCustomerAccessible({ ...officer, id: 44 }, 125, { state }),
    (error) => error.statusCode === 403
  );
  const where = {};
  visitPlanService.applyUserVisibility(officer, where);
  assert.equal(where.assignedUserId, state.plans[0].assignedUserId);
});

test('An assigned field officer can schedule for another employee', async (t) => {
  const fixture = assignmentFixture(t);
  const officer = { id: 42, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 };
  await visitPlanService.schedule(officer, scheduleInput);
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8, 43]);
  assert.equal(fixture.getState().plans[0].createdBy, 42);
  assert.equal(fixture.getState().plans[0].assignedUserId, 43);
});

test('An unauthorized customer cannot be assigned through scheduling', async (t) => {
  const fixture = assignmentFixture(t);
  const officer = { id: 44, hostId: 1, isAdminUser: 0, isFieldAppUser: 1 };
  await assert.rejects(visitPlanService.schedule(officer, scheduleInput), (error) => error.statusCode === 403);
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
  assert.deepEqual(fixture.getState().plans, []);
});

test('Scheduling does not duplicate an existing customer assignment', async (t) => {
  const fixture = assignmentFixture(t, [42, 43, 7]);
  await visitPlanService.schedule(assignmentAdmin, scheduleInput);
  assert.deepEqual(fixture.getState().assignments, [42, 43, 7]);
});

test('Rescheduling adds a new assignee and keeps the original creator and assignments', async (t) => {
  const fixture = assignmentFixture(t);
  await visitPlanService.schedule(assignmentAdmin, { ...scheduleInput, assignedUserId: 42 });
  await visitPlanService.reschedule(
    { ...assignmentAdmin, id: 8 },
    { visitId: 501, assignedUserId: 43, scheduledDate: '2026-11-28', remarks: 'Moved' }
  );
  const state = fixture.getState();
  assert.deepEqual(state.assignments, [42, 7, 8, 43]);
  assert.equal(state.plans[0].assignedUserId, 43);
  assert.equal(state.plans[0].createdBy, 7);
  assert.equal(state.history[1].performedBy, 8);
});

test('Rescheduling with the same assignee does not add another customer assignment', async (t) => {
  const fixture = assignmentFixture(t);
  await visitPlanService.schedule(assignmentAdmin, { ...scheduleInput, assignedUserId: 42 });
  await visitPlanService.reschedule(
    assignmentAdmin,
    { visitId: 501, assignedUserId: 42, scheduledDate: '2026-11-28', remarks: 'Moved' }
  );
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
});

test('Schedule failure rolls back the new assignment', async (t) => {
  const fixture = assignmentFixture(t);
  fixture.plans.create = async () => { throw new Error('visit write failed'); };
  await assert.rejects(visitPlanService.schedule(assignmentAdmin, scheduleInput), /visit write failed/);
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
  assert.deepEqual(fixture.getState().plans, []);
});

test('Schedule history failure rolls back the new assignment and visit', async (t) => {
  const fixture = assignmentFixture(t);
  fixture.plans.historyCreate = async () => { throw new Error('history write failed'); };
  await assert.rejects(visitPlanService.schedule(assignmentAdmin, scheduleInput), /history write failed/);
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
  assert.deepEqual(fixture.getState().plans, []);
});

test('Reschedule history failure rolls back the new assignment and visit update', async (t) => {
  const fixture = assignmentFixture(t);
  await visitPlanService.schedule(assignmentAdmin, { ...scheduleInput, assignedUserId: 42 });
  fixture.plans.historyCreate = async () => { throw new Error('history write failed'); };
  await assert.rejects(
    visitPlanService.reschedule(
      assignmentAdmin,
      { visitId: 501, assignedUserId: 43, scheduledDate: '2026-11-28', remarks: 'Moved' }
    ),
    /history write failed/
  );
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
  assert.equal(fixture.getState().plans[0].assignedUserId, 42);
  assert.equal(fixture.getState().history.length, 1);
});

test('Cross-host employee does not create an assignment or visit', async (t) => {
  const fixture = assignmentFixture(t);
  await assert.rejects(
    visitPlanService.schedule(assignmentAdmin, { ...scheduleInput, assignedUserId: 99 }),
    (error) => error.statusCode === 400
  );
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
  assert.deepEqual(fixture.getState().plans, []);
});

test('Cross-host reschedule assignee does not change the visit or assignments', async (t) => {
  const fixture = assignmentFixture(t);
  await visitPlanService.schedule(assignmentAdmin, { ...scheduleInput, assignedUserId: 42 });
  await assert.rejects(
    visitPlanService.reschedule(
      assignmentAdmin,
      { visitId: 501, assignedUserId: 99, scheduledDate: '2026-11-28', remarks: 'Moved' }
    ),
    (error) => error.statusCode === 400
  );
  assert.deepEqual(fixture.getState().assignments, [42, 7, 8]);
  assert.equal(fixture.getState().plans[0].assignedUserId, 42);
});
