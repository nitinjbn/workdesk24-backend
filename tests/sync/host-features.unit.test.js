require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');

const { HostFeatures } = require('../../src/models');
const { HostController } = require('../../src/modules/sync/controllers/host.controller');

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
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

test('getHostFeatures returns only enabled keys in the requested response shape', async (t) => {
  const enabled = [
    'ATTENDANCE',
    'LEAVE',
    'LOCATION_TRACKING',
    'VISIT',
    'FEEDBACK',
    'VISIT_IMAGE',
    'TASK_MANAGEMENT',
    'API_LOGS',
  ];
  let query;
  t.mock.method(HostFeatures, 'findAll', async (options) => {
    query = options;
    return enabled.map((featureKey) => HostFeatures.build({
      hostId: 3,
      featureKey,
      parentFeatureKey: ['FEEDBACK', 'VISIT_IMAGE'].includes(featureKey) ? 'VISIT' : null,
    }));
  });
  const res = createResponse();

  await new HostController().getHostFeatures({ body: { hostId: 3 } }, res, assert.ifError);

  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: 'Host features fetched successfully',
    data: { enabled },
  });
  assert.deepEqual(query, {
    attributes: ['featureKey', 'parentFeatureKey'],
    where: { hostId: 3, isEnabled: 1 },
  });
});

test('getHostFeatures includes a child with an enabled parent regardless of row order', async (t) => {
  t.mock.method(HostFeatures, 'findAll', async () => [
    HostFeatures.build({ hostId: 3, featureKey: 'FEEDBACK', parentFeatureKey: 'VISIT' }),
    HostFeatures.build({ hostId: 3, featureKey: 'VISIT', parentFeatureKey: null }),
  ]);
  const res = createResponse();

  await new HostController().getHostFeatures({ body: { hostId: 3 } }, res, assert.ifError);

  assert.deepEqual(res.body.data, { enabled: ['FEEDBACK', 'VISIT'] });
});

test('getHostFeatures excludes children whose parent is not enabled for the host', async (t) => {
  // Disabled or missing parents are absent from the repository's isEnabled = 1 results.
  t.mock.method(HostFeatures, 'findAll', async () => [
    HostFeatures.build({ hostId: 3, featureKey: 'ATTENDANCE', parentFeatureKey: null }),
    HostFeatures.build({ hostId: 3, featureKey: 'FEEDBACK', parentFeatureKey: 'VISIT' }),
    HostFeatures.build({ hostId: 3, featureKey: 'VISIT_IMAGE', parentFeatureKey: 'VISIT' }),
  ]);
  const res = createResponse();

  await new HostController().getHostFeatures({ body: { hostId: 3 } }, res, assert.ifError);

  assert.deepEqual(res.body.data, { enabled: ['ATTENDANCE'] });
});

test('getHostFeatures returns an empty enabled array when all enabled rows have unavailable parents', async (t) => {
  t.mock.method(HostFeatures, 'findAll', async () => [
    HostFeatures.build({ hostId: 3, featureKey: 'FEEDBACK', parentFeatureKey: 'VISIT' }),
  ]);
  const res = createResponse();

  await new HostController().getHostFeatures({ body: { hostId: 3 } }, res, assert.ifError);

  assert.deepEqual(res.body.data, { enabled: [] });
});

test('getHostFeatures returns an empty enabled array when no rows are enabled', async (t) => {
  t.mock.method(HostFeatures, 'findAll', async () => []);
  const res = createResponse();

  await new HostController().getHostFeatures({ body: { hostId: 3 } }, res, assert.ifError);

  assert.deepEqual(res.body, {
    success: true,
    message: 'Host features fetched successfully',
    data: { enabled: [] },
  });
});

test('getHostFeatures rejects invalid host IDs without querying the database', async (t) => {
  const findAll = t.mock.method(HostFeatures, 'findAll', async () => []);

  for (const hostId of [undefined, null, '', '3', 0, -1, 1.5, true, {}, [], Number.MAX_SAFE_INTEGER + 1]) {
    const res = createResponse();
    await new HostController().getHostFeatures({ body: { hostId } }, res, assert.ifError);

    assert.equal(res.statusCode, 400);
    assert.deepEqual(res.body, {
      success: false,
      message: 'hostId must be a positive integer',
      data: null,
    });
  }

  assert.equal(findAll.mock.callCount(), 0);
});

test('getHostFeatures forwards database errors without sending a success response', async (t) => {
  const error = new Error('Database unavailable');
  t.mock.method(HostFeatures, 'findAll', async () => {
    throw error;
  });
  const res = createResponse();
  let forwardedError;

  await new HostController().getHostFeatures({ body: { hostId: 3 } }, res, (err) => {
    forwardedError = err;
  });

  assert.equal(forwardedError, error);
  assert.equal(res.body, undefined);
});

test('Postman documents the authenticated endpoint and exact response contract', () => {
  const collection = JSON.parse(
    fs.readFileSync(path.join(__dirname, '../../Workdesk24_API_v3.postman_collection.json'), 'utf8')
  );
  const endpoint = collection.item.find((item) => item.name === 'App')
    .item.find((item) => item.name === 'Get Host Features');

  assert.equal(endpoint.request.method, 'POST');
  assert.equal(endpoint.request.url.raw, '{{BASE_URL}}/api/v1/app/getHostFeatures');
  assert.ok(endpoint.request.header.some(
    (header) => header.key === 'Authorization' && header.value === 'Bearer {{TOKEN}}'
  ));
  assert.deepEqual(JSON.parse(endpoint.request.body.raw), { hostId: 1 });
  assert.deepEqual(JSON.parse(endpoint.response[0].body), {
    success: true,
    message: 'Host features fetched successfully',
    data: {
      enabled: [
        'ATTENDANCE', 'LEAVE', 'LOCATION_TRACKING', 'VISIT',
        'FEEDBACK', 'VISIT_IMAGE', 'TASK_MANAGEMENT', 'API_LOGS',
      ],
    },
  });
});
