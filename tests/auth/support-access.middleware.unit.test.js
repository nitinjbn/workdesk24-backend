require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { requireSupportReadOnlyPolicy } = require('../../src/shared/middleware/support-access.middleware');

function createResponse() {
  return {
    statusCode: 200,
    body: null,
    status(code) {
      this.statusCode = code;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

test('read-only support allows known POST query routes', () => {
  const response = createResponse();
  let continued = false;

  requireSupportReadOnlyPolicy(
    {
      path: '/reports/getAttendance',
      authContext: { isSupportSession: true, accessMode: 'SUPPORT_READ_ONLY' },
    },
    response,
    () => { continued = true; }
  );

  assert.equal(continued, true);
  assert.equal(response.statusCode, 200);
});

test('read-only support denies unclassified POST routes by default', () => {
  const response = createResponse();
  let continued = false;

  requireSupportReadOnlyPolicy(
    {
      path: '/customers/createCustomer',
      authContext: { isSupportSession: true, accessMode: 'SUPPORT_READ_ONLY' },
    },
    response,
    () => { continued = true; }
  );

  assert.equal(continued, false);
  assert.equal(response.statusCode, 403);
  assert.equal(response.body.code, 'SUPPORT_READ_ONLY');
});

test('the support read-only gate does not change normal admin behavior', () => {
  let continued = false;

  requireSupportReadOnlyPolicy({ path: '/customers/createCustomer' }, createResponse(), () => {
    continued = true;
  });

  assert.equal(continued, true);
});

test('read-only support allows category reads but blocks every category mutation', () => {
  for (const [action, allowed] of [
    ['list', true], ['detail', true], ['create', false], ['update', false], ['delete', false], ['toggle-status', false],
  ]) {
    const response = createResponse();
    let continued = false;
    requireSupportReadOnlyPolicy({
      path: `/tasks/task-categories/${action}`,
      authContext: { isSupportSession: true, accessMode: 'SUPPORT_READ_ONLY' },
    }, response, () => { continued = true; });
    assert.equal(continued, allowed);
    assert.equal(response.statusCode, allowed ? 200 : 403);
  }
});