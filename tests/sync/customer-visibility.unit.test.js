require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const { Customer } = require('../../src/models');
const { CustomerRepository } = require('../../src/modules/sync/repositories/customers.repository');

test('sync customers include unassigned customers or those assigned to the user', async () => {
  const originalQuery = Customer.sequelize.query;
  let selectSql;

  Customer.sequelize.query = async (sql) => {
    selectSql = sql;
    return [];
  };

  try {
    await new CustomerRepository().getCustomers({ hostId: 3, userId: 7 });
  } finally {
    Customer.sequelize.query = originalQuery;
  }

  assert.match(
    selectSql,
    /LEFT OUTER JOIN `wd_customer_user_assignments` AS `customerUserAssignments`/
  );
  assert.match(selectSql, /`customerUserAssignments`\.`hostId` = 3/);
  assert.match(selectSql, /`customerUserAssignments`\.`isDeleted` = 0/);
  assert.match(selectSql, /`customerUserAssignments`\.`id` IS NULL/);
  assert.match(selectSql, /`customerUserAssignments`\.`userId` = 7/);
  assert.match(
    selectSql,
    /`customerUserAssignments`\.`id` IS NULL OR `customerUserAssignments`\.`userId` = 7/
  );
});
