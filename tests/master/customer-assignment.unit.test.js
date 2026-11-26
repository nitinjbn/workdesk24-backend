require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { CustomerService } = require('../../src/modules/master/services/customer.service');
const customerController =
  require('../../src/modules/master/controllers/customer.controller').default;
const { Customer } = require('../../src/models');
const CustomerUserAssignment = require('../../src/models/schemas/CustomerUserAssignment').default;
const customerRepository =
  require('../../src/modules/master/repositories/customer.repository').default;

test('customer assignment diff separates new and removed users', () => {
  const service = new CustomerService();

  const result = service.resolveCustomerUserAssignmentChanges([1, 2, 3], [2, 3, 4, 5]);

  assert.deepEqual(result, {
    toInsert: [4, 5],
    toDelete: [1],
  });
});

test('transactional assignment uses a tenant-scoped customer lock and a current read', async (t) => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const customerLock = t.mock.method(Customer, 'findOne', async () => ({ id: 8 }));
  const assignmentRead = t.mock.method(CustomerUserAssignment, 'findAll', async () => [{ userId: 8 }]);
  const assignmentWrite = t.mock.method(CustomerUserAssignment, 'bulkCreate', async () => []);

  await new CustomerService().assignUserIfCustomerRestricted(3, 8, 7, transaction);

  assert.deepEqual(customerLock.mock.calls[0].arguments[0].where, { id: 8, hostId: 3, isDeleted: 0 });
  assert.equal(customerLock.mock.calls[0].arguments[0].lock, 'UPDATE');
  assert.deepEqual(assignmentRead.mock.calls[0].arguments[0].where, { hostId: 3, customerId: 8, isDeleted: 0 });
  assert.equal(assignmentRead.mock.calls[0].arguments[0].lock, 'UPDATE');
  assert.equal(assignmentRead.mock.calls[0].arguments[0].transaction, transaction);
  assert.equal(assignmentWrite.mock.calls[0].arguments[1].transaction, transaction);
  assert.equal(assignmentWrite.mock.calls[0].arguments[0][0].userId, 7);
});

test('visit assignment leaves an open customer unassigned', async (t) => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(Customer, 'findOne', async () => ({ id: 8 }));
  t.mock.method(CustomerUserAssignment, 'findAll', async () => []);
  const assignmentWrite = t.mock.method(CustomerUserAssignment, 'bulkCreate', async () => []);

  await new CustomerService().assignUserIfCustomerRestricted(3, 8, 7, transaction);

  assert.equal(assignmentWrite.mock.callCount(), 0);
});

test('paginated customers select customer type from an available join', async () => {
  const originalCount = Customer.count;
  const originalQuery = Customer.sequelize.query;
  let selectSql;

  Customer.count = async () => 0;
  Customer.sequelize.query = async (sql) => {
    selectSql = sql;
    return [];
  };

  try {
    await customerRepository.getCustomers({ hostId: 1, page: 1, limit: 10 });
  } finally {
    Customer.count = originalCount;
    Customer.sequelize.query = originalQuery;
  }

  assert.match(selectSql, /JOIN `wd_customer_types` AS `customerTypeDetails`/);
  assert.match(selectSql, /`customerTypeDetails`\.`customerTypeName`/);
  assert.match(
    selectSql,
    /ORDER BY `Customer`\.`createdAt` DESC, `Customer`\.`updatedAt` DESC/
  );
  assert.doesNotMatch(selectSql, /FROM \(SELECT/);
});

test('customer list serializes assigned users', async () => {
  const originalFindAll = Customer.findAll;
  const customer = Customer.build({ id: 1, hostId: 1, customerName: 'Test customer' });
  customer.setDataValue('customerUserAssignments', [
    { userId: 7, user: { id: 7, name: 'Test user', employeeCode: 'E007' } },
  ]);
  Customer.findAll = async () => [customer];

  let result;
  try {
    result = await customerRepository.getCustomers({ hostId: 1 });
  } finally {
    Customer.findAll = originalFindAll;
  }

  const [serializedCustomer] = JSON.parse(JSON.stringify(result.data));
  assert.deepEqual(serializedCustomer.assignedUsers, [
    { userId: 7, employeeName: 'Test user', employeeCode: 'E007' },
  ]);
  assert.equal('customerUserAssignments' in serializedCustomer, false);
});

async function requestCustomerNames(body, hostId = 7) {
  let response;
  await customerController.getAllCustomers(
    { body, user: { hostId } },
    { json: (payload) => { response = payload; } },
    (error) => { throw error; }
  );
  return response.data;
}

test('report filter selects only the customer lookup fields without a count or limit by default', async (t) => {
  const customer = Customer.build({ id: 8, customerName: 'Acme', email: 'not-returned@example.com' });
  customer.setDataValue('customerType', 'Retailer');
  const select = t.mock.method(Customer.sequelize, 'query', async () => [customer]);
  const count = t.mock.method(Customer, 'count', async () => 1);

  assert.deepEqual(await requestCustomerNames({}), {
    customers: [{ id: 8, customerName: 'Acme', customerCode: null, customerType: 'Retailer' }],
  });
  assert.equal(count.mock.callCount(), 0);
  assert.equal(select.mock.callCount(), 1);
  const [sql] = select.mock.calls[0].arguments;
  assert.match(sql, /^SELECT `Customer`\.`id`, `Customer`\.`customerName`, `Customer`\.`customerCode`, `customerTypeDetails`\.`customerTypeName` AS `customerType` FROM /);
  assert.match(sql, /LEFT OUTER JOIN `wd_customer_types` AS `customerTypeDetails`/);
  assert.match(sql, /WHERE `Customer`\.`hostId` = 7 AND `Customer`\.`isDeleted` = 0/);
  assert.match(sql, /ORDER BY `Customer`\.`customerName` ASC, `Customer`\.`id` ASC/);
  assert.doesNotMatch(sql, /\bLIMIT\b/);
});

test('report filter applies limit and offset only when pagination is requested', async (t) => {
  const customer = Customer.build({ id: 9, customerName: 'Beta', customerCode: 'B9' });
  customer.setDataValue('customerType', null);
  const select = t.mock.method(Customer.sequelize, 'query', async () => [customer]);
  const count = t.mock.method(Customer, 'count', async () => 3);

  const result = await requestCustomerNames({ page: 2, limit: 2 });
  assert.deepEqual(result.customers, [
    { id: 9, customerName: 'Beta', customerCode: 'B9', customerType: null },
  ]);
  assert.deepEqual(result.pagination, {
    total: 3, page: 2, limit: 2, totalPages: 2,
    hasNextPage: false, hasPreviousPage: true, nextPage: null, previousPage: 1,
  });
  assert.equal(count.mock.callCount(), 1);
  assert.match(select.mock.calls[0].arguments[0], /LIMIT 2, 2/);
});

test('report filter accepts matching numeric or string host IDs and rejects a different host', async (t) => {
  const select = t.mock.method(Customer.sequelize, 'query', async () => []);
  assert.deepEqual(await requestCustomerNames({ hostId: 7 }, '7'), { customers: [] });
  assert.deepEqual(await requestCustomerNames({ hostId: '7' }), { customers: [] });
  await assert.rejects(requestCustomerNames({ hostId: 8 }, '7'), {
    code: 'ACCESS_DENIED',
    statusCode: 403,
  });
  assert.equal(select.mock.callCount(), 2);
});

test('report filter rejects invalid pagination before querying', async (t) => {
  const select = t.mock.method(Customer.sequelize, 'query', async () => []);
  for (const body of [{ page: 1 }, { limit: 1 }, { page: 1, limit: 101 }, { page: 0, limit: 1 }]) {
    await assert.rejects(requestCustomerNames(body), { code: 'VALIDATION_ERROR', statusCode: 400 });
  }
  assert.equal(select.mock.callCount(), 0);
});
