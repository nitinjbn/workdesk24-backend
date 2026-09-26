require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { CustomerService } = require('../../src/modules/master/services/customer.service');
const { Customer } = require('../../src/models');
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
