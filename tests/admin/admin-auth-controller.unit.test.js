require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const authService = require('../../src/modules/auth/services/auth.service').default;
const adminAuthController = require('../../src/modules/admin/controllers/auth.controller').default;

test('admin login returns enabled features in the response data', async (context) => {
  const enabledFeatures = ['TASK_MANAGEMENT', 'CUSTOMER_MANAGEMENT'];
  context.mock.method(authService, 'adminLogin', async () => ({
    user: { id: 12 },
    subscription: { status: 'ACTIVE', canUseApp: true, isReadOnly: false, canRenew: false },
    permissionsByModule: [],
    enabledFeatures,
    accessToken: 'access-token',
    refreshToken: 'refresh-token',
    csrfToken: 'csrf-token',
  }));
  let responseBody;
  const response = {
    cookie() {},
    setHeader() {},
    json(body) {
      responseBody = body;
    },
  };

  await adminAuthController.login(
    { body: { email: 'admin@example.com', password: 'password' } },
    response,
    (error) => { throw error; }
  );

  assert.deepEqual(responseBody.data.enabledFeatures, enabledFeatures);
});
