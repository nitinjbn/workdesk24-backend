require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const test = require('node:test');
const { sequelize, Customer, Order } = require('../../src/models');
const { OrderProductRepository } = require('../../src/modules/sync/repositories/order-product.repository');
const { SyncService } = require('../../src/modules/sync/services/sync.service');

test('shared sync data resolves customer local IDs and rejects unknown local IDs', async (t) => {
  const transaction = {};
  t.mock.method(sequelize, 'transaction', async (work) => work(transaction));
  const customerLookup = t.mock.method(Customer, 'findOne', async ({ where, transaction: tx }) => {
    assert.equal(tx, transaction);
    assert.equal(where.hostId, 1);
    assert.equal(where.isDeleted, 0);
    return where.localId === 'customer-local-1' ? Customer.build({ id: 53 }) : null;
  });

  const persisted = [];
  const repository = {
    getSequelize: () => sequelize,
    findOne: async () => null,
    create: async (values) => {
      persisted.push(values);
      return { id: persisted.length, toJSON: () => ({ ...values, id: persisted.length }) };
    },
  };
  const callbackCustomerIds = [];
  const service = new SyncService();
  const result = await service.syncData(
    repository,
    7,
    [
      { hostId: 1, localId: 'payment-1', customerId: 'customer-local-1' },
      { hostId: 1, localId: 'payment-2', customerId: '53' },
      { hostId: 1, localId: 'payment-3', customerId: 'unknown-customer' },
    ],
    async (_record, _transaction, _previousRecord, sourceRecord) => {
      callbackCustomerIds.push(sourceRecord.customerId);
    }
  );

  assert.deepEqual(persisted.map((record) => record.customerId), [53, 53]);
  assert.deepEqual(callbackCustomerIds, [53, 53]);
  assert.equal(customerLookup.mock.callCount(), 2);
  assert.equal(result.success.length, 2);
  assert.equal(result.failed.length, 1);
  assert.match(result.failed[0].error, /Customer localId "unknown-customer" was not found/);
});

test('order sync reuses the order customer ID for product rows', async (t) => {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(sequelize, 'transaction', async (work) => work(transaction));
  const customerLookup = t.mock.method(Customer, 'findOne', async () => Customer.build({ id: 53 }));
  t.mock.method(Order, 'findOne', async () => null);
  const createOrder = t.mock.method(Order, 'create', async (values) =>
    Order.build({ ...values, id: 104 })
  );

  let savedProducts;
  t.mock.method(
    OrderProductRepository.prototype,
    'replaceForOrder',
    async (_orderId, _userId, products) => {
      savedProducts = products;
    }
  );

  const service = new SyncService();
  service.generateNextOrderNumber = async () => 'ORD-1';
  service.syncVisitSummaryForActivity = async () => {};
  service.syncDailySummaryForActivity = async () => {};
  service.logActivity = async () => {};
  service.upsertUserLastLocationFromRecord = async () => {};
  service.invalidateDashboardOverview = async () => {};

  const result = await service.syncOrders(7, [
    {
      hostId: 1,
      localId: 'order-local-1',
      visitId: 82,
      customerId: 'customer-local-1',
      products: [{
        productId: 12,
        productName: 'Product',
        quantity: 1,
        customerId: 'different-product-customer-local-id',
      }],
    },
  ]);

  assert.equal(result.failed.length, 0, JSON.stringify(result));
  assert.equal(createOrder.mock.calls[0].arguments[0].customerId, 53);
  assert.equal(savedProducts[0].customerId, 53);
  assert.equal(customerLookup.mock.callCount(), 1);
  assert.equal(result.success.length, 1);
  assert.equal(result.failed.length, 0);
});
