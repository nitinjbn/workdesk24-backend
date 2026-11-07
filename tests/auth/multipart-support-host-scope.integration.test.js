require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const express = require('express');
const http = require('node:http');
const multer = require('multer');
const models = require('../../src/models');
const { supportHostScopeMiddleware } = require('../../src/shared/middleware/auth.middleware');
const mediaStorage = require('../../src/shared/utils/media-storage.util');
const customerService = require('../../src/modules/master/services/customer.service').default;
const productService = require('../../src/modules/master/services/product.service').default;
const customerController = require('../../src/modules/master/controllers/customer.controller').default;
const productController = require('../../src/modules/master/controllers/product.controller').default;
const userController = require('../../src/modules/master/controllers/user.controller').default;
const userService = require('../../src/modules/master/services/user.service').default;
const userValidator = require('../../src/modules/master/helpers/user.validator').default;

test.after(async () => {
  await models.sequelize.close();
});

function sendMultipart(server, path, hostId) {
  return new Promise((resolve, reject) => {
    const boundary = '----workdesk24-test-boundary';
    const payload = [
      `--${boundary}\r\nContent-Disposition: form-data; name="hostId"\r\n\r\n${hostId}\r\n`,
      `--${boundary}\r\nContent-Disposition: form-data; name="media"; filename="proof.txt"\r\nContent-Type: text/plain\r\n\r\nfile-content\r\n`,
      `--${boundary}--\r\n`,
    ].join('');
    const address = server.address();
    const request = http.request({
      host: '127.0.0.1',
      port: address.port,
      path,
      method: 'POST',
      headers: {
        'content-type': `multipart/form-data; boundary=${boundary}`,
        'content-length': Buffer.byteLength(payload),
      },
    }, (response) => {
      let body = '';
      response.setEncoding('utf8');
      response.on('data', (chunk) => { body += chunk; });
      response.on('end', () => resolve({ status: response.statusCode, body: JSON.parse(body) }));
    });
    request.on('error', reject);
    request.end(payload);
  });
}

async function withServer(handler) {
  const server = http.createServer(handler);
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  try {
    return await server;
  } catch (error) {
    server.close();
    throw error;
  }
}

test('Multer-parsed support media hostId is replaced with the switched host', async () => {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });
  app.post(
    '/api/v1/admin/customers/uploadMedia',
    (req, _res, next) => {
      req.authContext = { isSupportSession: true, currentHostId: 41 };
      next();
    },
    upload.single('media'),
    supportHostScopeMiddleware,
    (req, res) => res.json({ hostId: req.body.hostId, fileReceived: !!req.file })
  );

  const server = await withServer(app);
  try {
    const result = await sendMultipart(server, '/api/v1/admin/customers/uploadMedia', 99);
    assert.equal(result.status, 200);
    assert.equal(result.body.hostId, 41);
    assert.equal(result.body.fileReceived, true);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('JSON support hostId is replaced with the switched host', async () => {
  const app = express();
  app.use(express.json());
  app.post(
    '/api/v1/admin/customers/createCustomer',
    (req, _res, next) => {
      req.authContext = { isSupportSession: true, currentHostId: 41 };
      next();
    },
    supportHostScopeMiddleware,
    (req, res) => res.json({ hostId: req.body.hostId })
  );

  const server = await withServer(app);
  try {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/customers/createCustomer`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ hostId: 99 }),
    });
    const body = await response.json();
    assert.equal(response.status, 200);
    assert.equal(body.hostId, 41);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('normal Admin multipart hostId behavior remains unchanged', async () => {
  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });
  app.post(
    '/api/v1/admin/customers/uploadMedia',
    upload.single('media'),
    supportHostScopeMiddleware,
    (req, res) => res.json({ hostId: req.body.hostId, fileReceived: !!req.file })
  );

  const server = await withServer(app);
  try {
    const result = await sendMultipart(server, '/api/v1/admin/customers/uploadMedia', 99);
    assert.equal(result.status, 200);
    assert.equal(result.body.hostId, '99');
    assert.equal(result.body.fileReceived, true);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('customer media upload stores and associates media with the switched host', async (context) => {
  let uploadedFolder;
  let savedPayload;
  context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async (_file, folder) => {
    uploadedFolder = folder;
    return { url: 'https://media.example/file', fileId: 'customer-file' };
  });
  context.mock.method(customerService, 'saveCustomerMedia', async (payload) => {
    savedPayload = payload;
    return { id: 501, isEnabled: 1, isPrimary: 0, ...payload };
  });

  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });
  app.post(
    '/api/v1/admin/customers/uploadMedia',
    (req, _res, next) => {
      req.authContext = { isSupportSession: true, currentHostId: 41 };
      next();
    },
    upload.single('media'),
    supportHostScopeMiddleware,
    (req, res, next) => customerController.uploadMedia(req, res, next)
  );

  const server = await withServer(app);
  try {
    const result = await sendMultipart(server, '/api/v1/admin/customers/uploadMedia', 99);
    assert.equal(result.status, 200);
    assert.equal(uploadedFolder, '41/customers');
    assert.equal(savedPayload.hostId, 41);
    assert.equal(savedPayload.customerId, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('product media upload stores and associates media with the switched host', async (context) => {
  let uploadedFolder;
  let savedPayload;
  context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async (_file, folder) => {
    uploadedFolder = folder;
    return { url: 'https://media.example/file', fileId: 'product-file' };
  });
  context.mock.method(productService, 'saveProductMedia', async (payload) => {
    savedPayload = payload;
    return { id: 502, isEnabled: 1, isPrimary: 0, ...payload };
  });

  const app = express();
  const upload = multer({ storage: multer.memoryStorage() });
  app.post(
    '/api/v1/admin/products/uploadMedia',
    (req, _res, next) => {
      req.authContext = { isSupportSession: true, currentHostId: 41 };
      next();
    },
    upload.single('media'),
    supportHostScopeMiddleware,
    (req, res, next) => productController.uploadMedia(req, res, next)
  );

  const server = await withServer(app);
  try {
    const result = await sendMultipart(server, '/api/v1/admin/products/uploadMedia', 99);
    assert.equal(result.status, 200);
    assert.equal(uploadedFolder, '41/products');
    assert.equal(savedPayload.hostId, 41);
    assert.equal(savedPayload.productId, 0);
  } finally {
    await new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve()));
  }
});

test('user creation validates, uploads and persists under the switched host', async (context) => {
  let eligibleHostId;
  let uploadedFolder;
  let createdPayload;
  context.mock.method(userValidator, 'checkCreateAppUserEligibility', async (hostId) => {
    eligibleHostId = hostId;
  });
  context.mock.method(userController, 'validateMobile', async () => ({
    isValid: true,
    countryCode: '+1',
    e164: '+15555550123',
  }));
  context.mock.method(userController, 'validateEmail', async () => ({
    isValid: true,
    email: 'employee@example.com',
  }));
  context.mock.method(mediaStorage, 'uploadBufferToMediaStorage', async (_file, folder) => {
    uploadedFolder = folder;
    return { url: 'https://media.example/profile', fileId: 'profile-file' };
  });
  context.mock.method(userService, 'createAppUser', async (payload) => {
    createdPayload = payload;
    return { user: { id: 700 } };
  });

  const response = {
    body: null,
    json(body) { this.body = body; return this; },
    status(code) { this.statusCode = code; return this; },
  };
  await userController.createAppUser({
    body: {
      hostId: 99,
      name: 'Employee',
      email: 'employee@example.com',
      mobile: '+15555550123',
      countryIsoCode: 'US',
    },
    user: { id: 7, hostId: 41, roleId: 1, isSuperAdmin: 1, isAdminUser: 0 },
    authContext: { isSupportSession: true, currentHostId: 41 },
    file: { originalname: 'profile.png', mimetype: 'image/png', size: 12 },
  }, response, (error) => { throw error; });

  assert.equal(eligibleHostId, 41);
  assert.equal(uploadedFolder, '41/users');
  assert.equal(createdPayload.hostId, 41);
  assert.equal(response.body.data.userId, 700);
});

test('user update resolves lookup, validation and update writes to the switched host', async (context) => {
  let lookupPayload;
  let updatePayload;
  context.mock.method(userService, 'getUserDetails', async (payload) => {
    lookupPayload = payload;
    return { user: { id: 700 } };
  });
  context.mock.method(userController, 'validateMobile', async () => ({
    isValid: true,
    countryCode: '+1',
    e164: '+15555550123',
  }));
  context.mock.method(userController, 'validateEmail', async () => ({
    isValid: true,
    email: 'employee@example.com',
  }));
  context.mock.method(userService, 'updateAppUser', async (payload) => {
    updatePayload = payload;
    return { user: { id: 700 } };
  });

  const response = {
    body: null,
    json(body) { this.body = body; return this; },
    status(code) { this.statusCode = code; return this; },
  };
  await userController.updateAppUser({
    body: {
      hostId: 99,
      userId: 700,
      name: 'Employee',
      email: 'employee@example.com',
      mobile: '+15555550123',
      countryIsoCode: 'US',
    },
    user: { id: 7, hostId: 41, roleId: 1, isSuperAdmin: 1, isAdminUser: 0 },
    authContext: { isSupportSession: true, currentHostId: 41 },
  }, response, (error) => { throw error; });

  assert.equal(lookupPayload.hostId, 41);
  assert.equal(updatePayload.hostId, 41);
  assert.equal(response.body.data.userId, 700);
});

test('user deletion resolves the lookup and delete under the switched host', async (context) => {
  let lookupPayload;
  let deletePayload;
  context.mock.method(userService, 'getUserDetails', async (payload) => {
    lookupPayload = payload;
    return { user: { id: 700 } };
  });
  context.mock.method(userService, 'deleteAppUser', async (payload) => {
    deletePayload = payload;
    return { user: { id: 700 } };
  });

  const response = {
    body: null,
    json(body) { this.body = body; return this; },
    status(code) { this.statusCode = code; return this; },
  };
  await userController.deleteAppUser({
    body: { hostId: 99, userId: 700 },
    user: { id: 7, hostId: 41, roleId: 1, isSuperAdmin: 1, isAdminUser: 0 },
    authContext: { isSupportSession: true, currentHostId: 41 },
  }, response, (error) => { throw error; });

  assert.equal(lookupPayload.hostId, 41);
  assert.equal(deletePayload.hostId, 41);
  assert.equal(response.body.data.userId, 700);
});