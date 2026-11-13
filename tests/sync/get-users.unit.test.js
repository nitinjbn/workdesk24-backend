require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { User } = require('../../src/models');
const { SyncController } = require('../../src/modules/sync/controllers/sync.controller');

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

test('getUsers returns all host field-app users ordered by name with only userId and name', async (t) => {
  const database = new DatabaseSync(':memory:');
  t.after(() => database.close());
  database.exec(`
    CREATE TABLE wd_users (
      id INTEGER, hostId INTEGER, name TEXT, isDeleted INTEGER,
      isFieldAppUser INTEGER, accountStatus TEXT
    );
    INSERT INTO wd_users VALUES
      (1, 3, 'Zoe', 0, 1, 'ACTIVE'),
      (2, 3, 'Alice', 0, 1, 'INACTIVE'),
      (3, 4, 'Other host', 0, 1, 'ACTIVE'),
      (4, 3, 'Deleted', 1, 1, 'ACTIVE'),
      (5, 3, 'Admin only', 0, 0, 'ACTIVE'),
      (6, 3, 'Alice', 0, 1, 'ACTIVE');
  `);
  const insert = database.prepare('INSERT INTO wd_users VALUES (?, 3, ?, 0, 1, ?)');
  for (let id = 7; id <= 36; id++) {
    insert.run(id, `Employee ${String(id).padStart(2, '0')}`, 'ACTIVE');
  }
  const query = t.mock.method(User.sequelize, 'query', async (sql) => {
    return database.prepare(sql).all().map((row) => User.build({ ...row }));
  });
  const res = createResponse();

  await new SyncController().getUsers({
    user: { id: 1, hostId: 3 },
    body: { hostId: 4, page: 2, limit: 1, filter: { name: 'Zoe' } },
  }, res, assert.ifError);

  assert.equal(query.mock.callCount(), 1);
  assert.equal(res.statusCode, 200);
  assert.deepEqual(res.body, {
    success: true,
    message: 'Users retrieved successfully',
    data: {
      users: [
        { userId: 2, name: 'Alice' },
        { userId: 6, name: 'Alice' },
        ...Array.from({ length: 30 }, (_, index) => ({
          userId: index + 7,
          name: `Employee ${String(index + 7).padStart(2, '0')}`,
        })),
        { userId: 1, name: 'Zoe' },
      ],
    },
  });
});

test('getUsers returns an empty users array without requiring request fields', async (t) => {
  t.mock.method(User, 'findAll', async () => []);
  const res = createResponse();

  await new SyncController().getUsers({ user: { hostId: 3 } }, res, assert.ifError);

  assert.deepEqual(res.body, {
    success: true,
    message: 'Users retrieved successfully',
    data: { users: [] },
  });
});

test('getUsers rejects a missing or invalid authenticated host without querying', async (t) => {
  const findAll = t.mock.method(User, 'findAll', async () => []);
  for (const hostId of [undefined, null, 0, -1, 1.5, '3', Number.MAX_SAFE_INTEGER + 1]) {
    const res = createResponse();
    await new SyncController().getUsers({
      user: hostId === undefined ? undefined : { hostId },
      body: { hostId: 3 },
    }, res, assert.ifError);
    assert.equal(res.statusCode, 401);
    assert.deepEqual(res.body, {
      success: false,
      message: 'Valid authenticated host is required',
      data: null,
    });
  }
  assert.equal(findAll.mock.callCount(), 0);
});

test('getUsers forwards database errors without sending a success response', async (t) => {
  const error = new Error('Database unavailable');
  t.mock.method(User, 'findAll', async () => { throw error; });
  const res = createResponse();
  let forwarded;

  await new SyncController().getUsers({ user: { hostId: 3 } }, res, (err) => {
    forwarded = err;
  });

  assert.equal(forwarded, error);
  assert.equal(res.body, undefined);
});
