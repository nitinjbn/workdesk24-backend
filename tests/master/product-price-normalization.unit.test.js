require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const productRepository = require('../../src/modules/master/repositories/product.repository').default;
const productService = require('../../src/modules/master/services/product.service').default;

test('createProduct saves blank optional prices as null', async (t) => {
  let createPayload;
  t.mock.method(productRepository, 'createProduct', async (payload) => {
    createPayload = payload;
    return { id: 44, get: () => ({ id: 44 }) };
  });

  await productService.createProduct(
    {
      hostId: 1,
      productName: 'Product',
      sellingPrice: 12,
      mrp: 12,
      purchasePrice: '',
      lastSellingPrice: '  ',
    },
    {}
  );

  assert.equal(createPayload.purchasePrice, null);
  assert.equal(createPayload.lastSellingPrice, null);
});

test('updateProduct saves blank optional prices as null', async (t) => {
  let updatePayload;
  t.mock.method(productRepository, 'getProductById', async () => ({
    data: { isEnabled: 1 },
  }));
  t.mock.method(productRepository, 'updateProduct', async ({ updatePayload: payload }) => {
    updatePayload = payload;
    return [1];
  });

  await productService.updateProduct(
    {
      hostId: 1,
      productId: 44,
      productName: 'Product',
      sellingPrice: 12,
      mrp: 12,
      purchasePrice: ' ',
      lastSellingPrice: '',
    },
    {}
  );

  assert.equal(updatePayload.purchasePrice, null);
  assert.equal(updatePayload.lastSellingPrice, null);
});

test('createProduct preserves numeric zero for optional prices', async (t) => {
  let createPayload;
  t.mock.method(productRepository, 'createProduct', async (payload) => {
    createPayload = payload;
    return { id: 44, get: () => ({ id: 44 }) };
  });

  await productService.createProduct(
    {
      hostId: 1,
      productName: 'Product',
      sellingPrice: 12,
      mrp: 12,
      purchasePrice: 0,
      lastSellingPrice: 2,
    },
    {}
  );

  assert.equal(createPayload.purchasePrice, 0);
  assert.equal(createPayload.lastSellingPrice, 2);
});
