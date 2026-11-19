require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { sequelize, Order, OrderProduct } = require('../../src/models');
const controller = require('../../src/modules/reporting/controllers/report.app.controller').default;

async function getOrderDetails(body, user = { hostId: '42' }) {
  const result = {};
  await controller.getOrderDetails(
    { body, user },
    { json: (payload) => { result.body = payload; } },
    (error) => { result.error = error; }
  );
  return result;
}

test('returns stored order and line-item fields using the authenticated host', async (t) => {
  const orderId = '9007199254740993';
  const order = { id: orderId, hostId: '42', localId: 'order-local', orderTime: '1782844200' };
  const line = { id: '456', orderId, productId: '9', localId: 'line-local', quantity: '2.00' };
  const findOrder = t.mock.method(sequelize, 'query', async () =>
    Order.build({ ...order, products: [line] }, { include: [{ model: OrderProduct, as: 'products' }] })
  );

  const result = await getOrderDetails({ orderId, hostId: '99' });

  assert.ifError(result.error);
  assert.equal(result.body.success, true);
  assert.equal(result.body.data.orderId, orderId);
  assert.equal(result.body.data.localId, order.localId);
  assert.equal(result.body.data.orderTime, order.orderTime);
  assert.equal(result.body.data.products, undefined);
  assert.equal(result.body.data.orderProducts.length, 1);
  for (const [field, value] of Object.entries(line)) {
    assert.equal(result.body.data.orderProducts[0][field], value);
  }
  assert.equal(findOrder.mock.callCount(), 1);
  const [sql] = findOrder.mock.calls[0].arguments;
  assert.match(sql, /`Order`\.`id` = CAST\('9007199254740993' AS SIGNED\)/);
  assert.match(sql, /`Order`\.`hostId` = CAST\('42' AS SIGNED\).*`Order`\.`isDeleted` = 0/);
  assert.match(sql, /LEFT OUTER JOIN `wd_orders_products` AS `products` ON .*`products`\.`hostId` = CAST\('42' AS SIGNED\).*`products`\.`isDeleted` = 0/);
});

test('returns an empty product list for an order without active line items', async (t) => {
  t.mock.method(sequelize, 'query', async () =>
    Order.build({ id: '123', products: [] }, { include: [{ model: OrderProduct, as: 'products' }] })
  );
  const result = await getOrderDetails({ orderId: 123 });
  assert.ifError(result.error);
  assert.deepEqual(result.body.data.orderProducts, []);
});

test('returns 404 when no active order is found within the host', async (t) => {
  t.mock.method(sequelize, 'query', async () => null);
  const result = await getOrderDetails({ orderId: 123 });
  assert.equal(result.error.statusCode, 404);
  assert.equal(result.error.code, 'ORDER_NOT_FOUND');
});

test('rejects invalid IDs and missing authenticated host before querying', async (t) => {
  const query = t.mock.method(sequelize, 'query', async () => null);
  for (const orderId of [undefined, 0, 1.5, 9007199254740992, '0', '1e3', '9223372036854775808', {}]) {
    const result = await getOrderDetails({ orderId });
    assert.equal(result.error.statusCode, 400, String(orderId));
  }
  const result = await getOrderDetails({ orderId: 123, hostId: 42 }, null);
  assert.equal(result.error.statusCode, 401);
  assert.equal(query.mock.callCount(), 0);
});
