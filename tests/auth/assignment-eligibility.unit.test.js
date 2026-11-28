const test = require('node:test');
const assert = require('node:assert/strict');
const { DatabaseSync } = require('node:sqlite');
const { randomBytes } = require('node:crypto');
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3306';
process.env.DB_NAME_TEST = 'wd_eligibility_unit_test';
process.env.JWT_SECRET = randomBytes(32).toString('hex');
const { fn, col } = require('sequelize');
const { User, sequelize } = require('../../src/models');
const { AssignmentEligibilityService } = require('../../src/modules/auth/services/assignment-eligibility.service');
const eligibilityService = require('../../src/modules/auth/services/assignment-eligibility.service').default;

test.before(() => test.mock.method(sequelize, 'query', async () => { throw new Error('Unexpected database query'); }));
test.after(() => sequelize.close());

function fixture(t) {
  const db = new DatabaseSync(':memory:');
  t.after(() => db.close());
  db.exec(`
    CREATE TABLE wd_users (id INTEGER PRIMARY KEY, hostId INTEGER, name TEXT,
      accountStatus TEXT DEFAULT 'ACTIVE', isDeleted INTEGER DEFAULT 0, isFieldAppUser INTEGER DEFAULT 1);
    CREATE TABLE wd_teams (id INTEGER PRIMARY KEY, hostId INTEGER, isEnabled INTEGER DEFAULT 1, isDeleted INTEGER DEFAULT 0);
    CREATE TABLE wd_team_members (hostId INTEGER, teamId INTEGER, userId INTEGER, isEnabled INTEGER DEFAULT 1);
    CREATE TABLE wd_team_assignment_rules (hostId INTEGER, sourceTeamId INTEGER, targetTeamId INTEGER,
      allowCustomerAssignment INTEGER DEFAULT 0, allowScheduleVisit INTEGER DEFAULT 0,
      allowRescheduleVisit INTEGER DEFAULT 0, isEnabled INTEGER DEFAULT 1, isDeleted INTEGER DEFAULT 0);
    INSERT INTO wd_users (id, hostId, name) VALUES
      (1,7,'Actor'),(2,7,'Alice'),(3,7,'Bob'),(4,7,'Aaron'),
      (5,7,'Inactive'),(6,7,'Deleted'),(7,8,'Foreign'),(8,7,'No teams');
    UPDATE wd_users SET isFieldAppUser = 0 WHERE id = 3;
    UPDATE wd_users SET accountStatus = 'INACTIVE' WHERE id = 5;
    UPDATE wd_users SET isDeleted = 1 WHERE id = 6;
    INSERT INTO wd_teams (id, hostId) VALUES (10,7),(20,7),(30,7),(40,7),(50,8);
    INSERT INTO wd_team_members (hostId,teamId,userId) VALUES
      (7,10,1),(7,20,2),(7,30,3),(7,20,4),(7,20,5),(7,20,6),(8,50,7);
    INSERT INTO wd_team_assignment_rules
      (hostId,sourceTeamId,targetTeamId,allowCustomerAssignment,allowScheduleVisit,allowRescheduleVisit)
      VALUES (7,10,20,1,1,1);
  `);
  // Execute the repository's actual generated SQL, rather than a second eligibility implementation.
  const generator = sequelize.getQueryInterface().queryGenerator;
  const queries = [];
  t.mock.method(User, 'findAndCountAll', async (options) => {
    queries.push(options);
    const select = generator.selectQuery(User.getTableName(), { ...options }, User);
    const count = generator.selectQuery(User.getTableName(), {
      where: options.where, attributes: [[fn('COUNT', col('*')), 'count']],
    }, User);
    return {
      rows: db.prepare(select).all().map((row) => User.build({ ...row })),
      count: db.prepare(count).get().count,
    };
  });
  const service = new AssignmentEligibilityService();
  const list = (fields = {}) => service.getEligibleUsers({ hostId: 7, actorId: 1, action: 'CUSTOMER_ASSIGNMENT', page: 1, limit: 10, ...fields });
  return { db, service, list, queries };
}

test('one active source team grants users from its direct target team', async (t) => {
  const h = fixture(t);
  const result = await h.list();
  assert.deepEqual(result.users, [{ userId: 4, name: 'Aaron' }, { userId: 1, name: 'Actor' }, { userId: 2, name: 'Alice' }]);
  assert.deepEqual(result.pagination, { total: 3, page: 1, limit: 10, totalPages: 1 });
  assert.equal(h.queries.length, 1);
});

test('targeted enforcement shares SQL eligibility, isolates hosts and uses the supplied transaction', async (t) => {
  const h = fixture(t);
  const transaction = { marker: 'caller transaction' };
  const payload = { hostId: 7, actorId: 1, action: 'SCHEDULE_VISIT', transaction };
  assert.equal(await h.service.isUserEligible({ ...payload, targetUserId: 2 }), true);
  assert.equal(h.queries.at(-1).transaction, transaction);
  assert.equal(h.queries.at(-1).where.id, 2);
  for (const targetUserId of [3, 5, 6, 7, 8, 999]) {
    assert.equal(await h.service.isUserEligible({ ...payload, targetUserId }), false);
  }
  h.db.exec('DELETE FROM wd_team_assignment_rules; DELETE FROM wd_team_members; UPDATE wd_users SET isFieldAppUser = 0 WHERE id = 1');
  assert.equal(await h.service.isUserEligible({ ...payload, targetUserId: 1 }), true);
  assert.equal(await h.service.isUserEligible({ ...payload, targetUserId: 2 }), false);
  await assert.rejects(h.service.isUserEligible({ ...payload, targetUserId: 0 }), { statusCode: 400 });
});

test('multiple source teams use OR, unrelated memberships do not disqualify, and duplicate users appear once', async (t) => {
  const h = fixture(t);
  h.db.exec(`
    INSERT INTO wd_team_members (hostId,teamId,userId) VALUES (7,30,1),(7,40,3),(7,40,2),(7,30,2);
    INSERT INTO wd_team_assignment_rules (hostId,sourceTeamId,targetTeamId,allowCustomerAssignment) VALUES (7,30,40,1);
  `);
  const result = await h.list();
  assert.deepEqual(result.users.map((user) => user.userId), [4, 1, 2, 3]);
  assert.equal(result.pagination.total, 4);
});

test('self is included once while other same-team users require the relevant permission', async (t) => {
  const h = fixture(t);
  h.db.exec(`
    DELETE FROM wd_team_assignment_rules;
    INSERT INTO wd_team_assignment_rules (hostId,sourceTeamId,targetTeamId,allowScheduleVisit) VALUES (7,10,10,1);
    INSERT INTO wd_team_members (hostId,teamId,userId) VALUES (7,10,2);
  `);
  assert.deepEqual((await h.list()).users, [{ userId: 1, name: 'Actor' }]);
  const scheduled = await h.list({ action: 'SCHEDULE_VISIT' });
  assert.deepEqual(scheduled.users, [{ userId: 1, name: 'Actor' }, { userId: 2, name: 'Alice' }]);
  assert.equal(scheduled.pagination.total, 2);
  assert.deepEqual((await h.list({ action: 'RESCHEDULE_VISIT' })).users, [{ userId: 1, name: 'Actor' }]);
});

test('direct rules do not propagate transitively', async (t) => {
  const h = fixture(t);
  h.db.exec(`INSERT INTO wd_team_assignment_rules
    (hostId,sourceTeamId,targetTeamId,allowCustomerAssignment) VALUES (7,20,30,1)`);
  assert.deepEqual((await h.list()).users.map((user) => user.userId), [4, 1, 2]);
});

test('disabled/deleted rules and disabled source or target memberships cannot grant eligibility', async (t) => {
  const h = fixture(t);
  for (const sql of [
    'UPDATE wd_team_assignment_rules SET isEnabled = 0',
    'UPDATE wd_team_assignment_rules SET isDeleted = 1',
    'UPDATE wd_team_members SET isEnabled = 0 WHERE userId = 1',
    'UPDATE wd_team_members SET isEnabled = 0 WHERE teamId = 20',
  ]) {
    h.db.exec('BEGIN');
    h.db.exec(sql);
    assert.deepEqual((await h.list()).users, [{ userId: 1, name: 'Actor' }], sql);
    h.db.exec('ROLLBACK');
  }
});

test('disabled/deleted teams on either side cannot grant eligibility', async (t) => {
  const h = fixture(t);
  for (const teamId of [10, 20]) {
    for (const flag of ['isEnabled', 'isDeleted']) {
      h.db.exec('BEGIN');
      h.db.exec(`UPDATE wd_teams SET ${flag} = ${flag === 'isEnabled' ? 0 : 1} WHERE id = ${teamId}`);
      assert.deepEqual((await h.list()).users, [{ userId: 1, name: 'Actor' }]);
      h.db.exec('ROLLBACK');
    }
  }
});

test('inactive/deleted targets are excluded and inactive actors cannot grant eligibility to others', async (t) => {
  const h = fixture(t);
  assert.deepEqual((await h.list()).users.map((user) => user.userId), [4, 1, 2]);
  h.db.exec("UPDATE wd_users SET accountStatus = 'INACTIVE' WHERE id = 1");
  assert.deepEqual((await h.list()).users, [{ userId: 1, name: 'Actor' }]);
});

test('visit actions require field-app users and permission fields remain independent', async (t) => {
  const h = fixture(t);
  h.db.exec(`INSERT INTO wd_team_assignment_rules
    (hostId,sourceTeamId,targetTeamId,allowCustomerAssignment,allowScheduleVisit,allowRescheduleVisit)
    VALUES (7,10,30,1,1,1)`);
  assert.deepEqual((await h.list()).users.map((user) => user.userId), [4, 1, 2, 3]);
  for (const action of ['SCHEDULE_VISIT', 'RESCHEDULE_VISIT']) {
    assert.deepEqual((await h.list({ action })).users.map((user) => user.userId), [4, 1, 2]);
  }
  h.db.exec('UPDATE wd_team_assignment_rules SET allowScheduleVisit = 0');
  assert.deepEqual((await h.list({ action: 'SCHEDULE_VISIT' })).users, [{ userId: 1, name: 'Actor' }]);
  assert.equal((await h.list({ action: 'RESCHEDULE_VISIT' })).users.length, 3);
});

test('missing membership, missing rules and zero permissions include only self without a host fallback', async (t) => {
  const h = fixture(t);
  assert.deepEqual((await h.list({ actorId: 8 })).users, [{ userId: 8, name: 'No teams' }]);
  h.db.exec('UPDATE wd_team_assignment_rules SET allowCustomerAssignment = 0');
  assert.deepEqual((await h.list()).users, [{ userId: 1, name: 'Actor' }]);
  h.db.exec('DELETE FROM wd_team_assignment_rules');
  assert.deepEqual(await h.list(), { users: [{ userId: 1, name: 'Actor' }], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } });
});

test('cross-host membership, rule, team and user ownership mismatches cannot grant eligibility', async (t) => {
  const h = fixture(t);
  for (const sql of [
    'UPDATE wd_team_members SET hostId = 8 WHERE userId = 1',
    'UPDATE wd_team_members SET teamId = 50 WHERE userId = 1',
    'UPDATE wd_team_assignment_rules SET hostId = 8',
    'UPDATE wd_team_assignment_rules SET targetTeamId = 50',
    'UPDATE wd_team_members SET hostId = 8 WHERE teamId = 20',
    'UPDATE wd_users SET hostId = 8 WHERE id IN (2,4)',
  ]) {
    h.db.exec('BEGIN');
    h.db.exec(sql);
    assert.deepEqual((await h.list()).users, [{ userId: 1, name: 'Actor' }], sql);
    h.db.exec('ROLLBACK');
  }
});

test('search and pagination filter/count in the database with stable name/ID ordering', async (t) => {
  const h = fixture(t);
  const searched = await h.list({ search: ' ali ', page: '1', limit: '1' });
  assert.deepEqual(searched.users, [{ userId: 1, name: 'Actor' }]);
  assert.equal(searched.pagination.total, 2);
  assert.deepEqual((await h.list({ search: ' ali ', page: 2, limit: 1 })).users, [{ userId: 2, name: 'Alice' }]);
  h.db.exec("UPDATE wd_users SET name = 'Alice' WHERE id = 4");
  assert.deepEqual((await h.list({ limit: 1 })).users.map((user) => user.userId), [1]);
  assert.deepEqual((await h.list({ page: 2, limit: 1 })).users.map((user) => user.userId), [2]);
  assert.deepEqual((await h.list({ page: 3, limit: 1 })).users.map((user) => user.userId), [4]);
  assert.deepEqual((await h.list({ page: 4, limit: 1 })).users, []);
  assert.equal(h.queries.at(-1).limit, 1);
  assert.equal(h.queries.at(-1).offset, 3);
});

test('all actions include the actual actor without memberships/rules, field-app access or a search match', async (t) => {
  const h = fixture(t);
  h.db.exec("UPDATE wd_users SET name = 'Zoe', isFieldAppUser = 0 WHERE id = 8");
  for (const action of ['CUSTOMER_ASSIGNMENT', 'SCHEDULE_VISIT', 'RESCHEDULE_VISIT']) {
    assert.deepEqual((await h.list({ actorId: 8, action, search: 'unmatched' })).users, [{ userId: 8, name: 'Zoe' }]);
  }
});

test('pagination is optional and unpaged results remain sorted by name with self included once', async (t) => {
  const h = fixture(t);
  const payload = { hostId: 7, actorId: 1, action: 'CUSTOMER_ASSIGNMENT' };
  const result = await h.service.getEligibleUsers(payload);
  assert.deepEqual(result.users.map((user) => user.userId), [4, 1, 2]);
  assert.equal(Object.hasOwn(result, 'pagination'), false);
  assert.equal(Object.hasOwn(h.queries.at(-1), 'limit'), false);
  for (let id = 100; id < 111; id++) {
    h.db.prepare('INSERT INTO wd_users (id,hostId,name) VALUES (?,7,?)').run(id, `User ${id}`);
    h.db.prepare('INSERT INTO wd_team_members (hostId,teamId,userId) VALUES (7,20,?)').run(id);
  }
  assert.equal((await h.service.getEligibleUsers(payload)).users.length, 14);
  for (const fields of [{ page: 1 }, { limit: 1 }]) {
    assert.equal((await h.service.getEligibleUsers({ ...payload, ...fields })).pagination.total, 14);
  }
});

test('unsupported actions, invalid pagination/search and invalid context fail before querying', async () => {
  const service = new AssignmentEligibilityService({
    async findEligibleUsers() { throw new Error('Validation must run before querying'); },
  });
  const valid = { hostId: 7, actorId: 1, action: 'CUSTOMER_ASSIGNMENT' };
  for (const action of [undefined, null, '', 'schedule_visit', 'CUSTOMER', 'toString', {}]) {
    await assert.rejects(service.getEligibleUsers({ ...valid, action }), { code: 'VALIDATION_ERROR', statusCode: 400 });
  }
  for (const fields of [{ page: 0 }, { page: '1\n' }, { limit: true }, { limit: 101 }, { search: null }, { search: 'x'.repeat(101) }, { page: Number.MAX_SAFE_INTEGER, limit: 100 }]) {
    await assert.rejects(service.getEligibleUsers({ ...valid, ...fields }), { statusCode: 400 });
  }
  await assert.rejects(service.getEligibleUsers({ ...valid, actorId: 0 }), { statusCode: 401 });
});

test('database failures propagate rather than being returned as an empty success', async () => {
  const failure = new Error('Eligibility database unavailable');
  const service = new AssignmentEligibilityService({ async findEligibleUsers() { throw failure; } });
  await assert.rejects(service.getEligibleUsers({ hostId: 7, actorId: 1, action: 'CUSTOMER_ASSIGNMENT' }), (error) => error === failure);
});

test('app endpoint uses real JWT context, rejects unsupported actions and ignores forged actor/host IDs', async (t) => {
  const h = fixture(t);
  const express = require('express');
  const jwt = require('jsonwebtoken');
  const { once } = require('node:events');
  const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
  const { authMiddleware } = require('../../src/shared/middleware/auth.middleware');
  const { errorHandler } = require('../../src/shared/middleware/error-handler.middleware');
  const router = require('../../src/routes/v1/app/teams.routes').default;
  t.mock.method(console, 'error', () => {});
  t.mock.method(userRepository, 'findById', async (id) => id === 1 ? {
    id: 1, hostId: 7, accountStatus: 'ACTIVE', isAdminUser: 1,
  } : null);
  t.mock.method(eligibilityService, 'getEligibleUsers', (payload) => h.service.getEligibleUsers(payload));
  const app = express();
  app.use(express.json());
  app.use('/api/v1/app/teams', authMiddleware, router);
  app.use(errorHandler);
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const token = jwt.sign({ userId: 1, tokenType: 'access' }, process.env.JWT_SECRET);
  async function post(body, auth = `Bearer ${token}`) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/app/teams/getEligibleUsers`, {
      method: 'POST', headers: { 'content-type': 'application/json', authorization: auth }, body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await post({}, '')).status, 401);
  const result = await post({ action: 'CUSTOMER_ASSIGNMENT', hostId: 8, userId: 7, actorId: 7 });
  assert.equal(result.status, 200);
  assert.deepEqual(result.body.data.users.map((user) => user.userId), [4, 1, 2]);
  assert.equal(result.body.success, true);
  assert.equal(result.body.message, 'Eligible users retrieved successfully');
  assert.equal(Object.hasOwn(result.body.data, 'pagination'), false);
  const invalid = await post({ action: 'OTHER' });
  assert.equal(invalid.status, 400);
  assert.equal(invalid.body.success, false);
  assert.equal(invalid.body.code, 'VALIDATION_ERROR');
  h.db.exec('DELETE FROM wd_team_assignment_rules');
  assert.deepEqual((await post({ action: 'CUSTOMER_ASSIGNMENT' })).body.data.users, [{ userId: 1, name: 'Actor' }], 'Admin receives no organization-wide fallback');
});

test('Postman documents the authenticated app endpoint and exact response shape', () => {
  const fs = require('node:fs');
  const path = require('node:path');
  const collection = JSON.parse(fs.readFileSync(path.join(__dirname, '../../Workdesk24_API_v3.postman_collection.json'), 'utf8'));
  const item = collection.item.find((folder) => folder.name === 'App').item.find((request) => request.name === 'Get Team Eligible Users');
  assert.equal(item.request.method, 'POST');
  assert.equal(item.request.url.raw, '{{BASE_URL}}/api/v1/app/teams/getEligibleUsers');
  assert.ok(item.request.header.some((header) => header.key === 'Authorization'));
  assert.deepEqual(Object.keys(JSON.parse(item.request.body.raw)).sort(), ['action', 'limit', 'page', 'search']);
  const response = JSON.parse(item.response[0].body);
  assert.deepEqual(Object.keys(response.data.users[0]).sort(), ['name', 'userId']);
  const selfOnly = JSON.parse(item.response[1].body).data;
  assert.equal(selfOnly.users.length, 1);
  assert.equal(Object.hasOwn(selfOnly, 'pagination'), false);
});
