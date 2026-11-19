require('ts-node/register/transpile-only');

const assert = require('node:assert/strict');
const test = require('node:test');
const { sequelize, Order, OrderProduct } = require('../../src/models');
const controller = require('../../src/modules/sync/controllers/sync.controller').default;
const service = require('../../src/modules/sync/services/sync.service').default;

async function revise(body, hostId = 1) {
  let response;
  await controller.revisedOrder(
    { body, user: { hostId, id: 99 } },
    { json: (payload) => { response = payload; } },
    (error) => { throw error; }
  );
  return response;
}

function setup(t, createProducts) {
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  const original = Order.build({
    id: 103, hostId: 1, userId: 47, visitId: 317, customerId: 125,
    localId: 'original-local-id', orderNumber: 'ORD-18', totalAmount: 32935, orderTime: 1794969842,
  });
  const originalLine = OrderProduct.build({
    id: 126, orderId: 103, hostId: 1, userId: 47, visitId: 317, customerId: 125,
    productId: 6, productName: 'Product A', quantity: 100, mrp: 15,
  });
  const omittedLine = OrderProduct.build({ id: 127, orderId: 103, hostId: 1 });
  let newProducts;
  t.mock.method(sequelize, 'transaction', async (work) => work(transaction));
  const lookup = t.mock.method(Order, 'findOne', async () => original);
  const create = t.mock.method(Order, 'create', async (values) => Order.build({ ...values, id: 104 }));
  const markReplaced = t.mock.method(original, 'update', async (values) => original.set(values));
  t.mock.method(OrderProduct, 'findAll', async ({ where }) =>
    where.orderId === 103 ? [originalLine, omittedLine] : newProducts
  );
  const copy = t.mock.method(OrderProduct, 'bulkCreate', createProducts ?? (async (lines) => {
    newProducts = lines.map((line, index) => OrderProduct.build({ ...line, id: 128 + index }));
  }));
  const visit = t.mock.method(service, 'syncVisitSummaryForActivity', async () => {});
  t.mock.method(service, 'syncDailySummaryForActivity', async () => {});
  const invalidate = t.mock.method(service, 'invalidateDashboardOverview', async () => {});
  return { transaction, original, originalLine, omittedLine, lookup, create, copy, markReplaced, visit, invalidate };
}

test('creates a new order and new product rows, then links the archived original', async (t) => {
  const fixture = setup(t);
  const response = await revise({
    orderId: 103, hostId: '1', userId: 99, orderNumber: 'CLIENT', totalAmount: '150.00',
    orderProducts: [{ id: 126, orderId: 999, productId: 6, productName: 'Product A', quantity: 10 }],
  });
  assert.equal(response.success, true);
  const { data } = response;
  assert.equal(data.orderId, 104);
  assert.equal(data.previousOrderId, 103);
  assert.equal(data.orderNumber, 'ORD-18');
  assert.equal(data.userId, 47);
  assert.equal(data.localId, 'original-local-id');
  assert.equal(data.visitId, 317);
  assert.equal(data.customerId, 125);
  assert.equal(data.isRevised, 1);
  assert.equal(data.isDeleted, 0);
  assert.equal(data.revisedOrderId, null);
  assert.equal(data.totalAmount, 150);
  assert.equal(fixture.original.isDeleted, 1);
  assert.equal(fixture.original.revisedOrderId, 104);
  assert.equal(fixture.original.totalAmount, 32935);
  assert.equal(fixture.originalLine.quantity, 100);
  assert.equal(fixture.omittedLine.isDeleted, 0);
  assert.equal(data.orderProducts.length, 1);
  assert.equal(data.orderProducts[0].id, 128);
  assert.equal(data.orderProducts[0].orderId, 104);
  assert.equal(data.orderProducts[0].quantity, 10);
  assert.equal(data.orderProducts[0].mrp, 15);
  const [lookup] = fixture.lookup.mock.calls[0].arguments;
  assert.deepEqual(lookup.where, { id: 103, hostId: 1, isDeleted: 0 });
  assert.equal(lookup.lock, 'UPDATE');
  for (const method of [fixture.create, fixture.copy, fixture.markReplaced]) {
    assert.equal(method.mock.calls[0].arguments[1].transaction, fixture.transaction);
  }
  assert.equal(fixture.visit.mock.calls[0].arguments[0].id, 104);
  assert.equal(fixture.invalidate.mock.callCount(), 1);
});

test('rejects a host mismatch or a product line not on the original without writing', async (t) => {
  const fixture = setup(t);
  await assert.rejects(revise({ orderId: 103, hostId: 2 }), { statusCode: 403 });
  assert.equal(fixture.lookup.mock.callCount(), 0);
  await assert.rejects(revise({
    orderId: 103, hostId: 1, orderProducts: [{ id: 999, productName: 'Unknown', quantity: 1 }],
  }), { statusCode: 400 });
  assert.equal(fixture.create.mock.callCount(), 0);
  assert.equal(fixture.markReplaced.mock.callCount(), 0);
});

test('does not archive the original or publish invalidation if product insertion fails', async (t) => {
  const fixture = setup(t, async () => { throw new Error('insertion failed'); });
  await assert.rejects(revise({ orderId: 103, hostId: 1 }), /insertion failed/);
  assert.equal(fixture.copy.mock.calls[0].arguments[0].length, 2);
  assert.equal(fixture.markReplaced.mock.callCount(), 0);
  assert.equal(fixture.invalidate.mock.callCount(), 0);
});

test('a replay through sync/orders returns the active revision without overwriting it', async (t) => {
  const fixture = setup(t);
  fixture.original.setDataValue('id', 104);
  fixture.original.set('isRevised', 1);
  const result = await service.syncOrders(47, [{
    hostId: 1, visitId: 317, localId: 'original-local-id', totalAmount: 10,
  }]);

  assert.deepEqual(result, {
    success: [],
    failed: [],
    updated: [{ localId: 'original-local-id', serverId: 104, orderNumber: 'ORD-18' }],
  });
  assert.equal(fixture.create.mock.callCount(), 0);
  assert.equal(fixture.original.totalAmount, 32935);
});
