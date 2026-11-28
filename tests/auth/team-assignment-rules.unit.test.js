const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3306';
process.env.DB_NAME_TEST = 'wd_team_rule_unit_test';
const { Team, TeamAssignmentRule, sequelize } = require('../../src/models');
const { TeamAssignmentRuleService } = require('../../src/modules/auth/services/team-assignment-rule.service');
const ruleService = require('../../src/modules/auth/services/team-assignment-rule.service').default;
const { TeamAssignmentRuleRepository } = require('../../src/modules/auth/repositories/team-assignment-rule.repository');
const { TeamAssignmentRuleController } = require('../../src/modules/admin/controllers/team-assignment-rule.controller');
const { UniqueConstraintError } = require('sequelize');

test.before(() => test.mock.method(sequelize, 'query', async () => { throw new Error('Unexpected database query'); }));
test.after(() => sequelize.close());

const admin = { hostId: 7, isAdmin: true };
const permissions = ['allowCustomerAssignment', 'allowScheduleVisit', 'allowRescheduleVisit'];

function harness() {
  const teams = new Map([
    [10, { id: 10, hostId: 7, teamName: 'Callers', isEnabled: 1, isDeleted: 0 }],
    [20, { id: 20, hostId: 7, teamName: 'Field Officers', isEnabled: 1, isDeleted: 0 }],
    [30, { id: 30, hostId: 7, teamName: 'Support', isEnabled: 0, isDeleted: 0 }],
    [40, { id: 40, hostId: 8, teamName: 'Foreign', isEnabled: 1, isDeleted: 0 }],
    [50, { id: 50, hostId: 7, teamName: 'Deleted', isEnabled: 1, isDeleted: 1 }],
  ]);
  const rows = new Map();
  const transactions = [];
  const locks = [];
  let failWrite = false;
  const transactionFactory = async () => {
    const snapshot = structuredClone([...rows]);
    const transaction = {
      committed: false, rolledBack: false,
      async commit() { this.committed = true; },
      async rollback() {
        this.rolledBack = true;
        rows.clear();
        for (const [id, row] of snapshot) rows.set(id, row);
      },
    };
    transactions.push(transaction);
    return transaction;
  };
  const repository = {
    async findPair(hostId, sourceTeamId, targetTeamId) {
      const row = [...rows.values()].find((rule) =>
        rule.hostId === hostId && rule.sourceTeamId === sourceTeamId && rule.targetTeamId === targetTeamId);
      return row ? TeamAssignmentRule.build(row) : null;
    },
    async find(hostId, ruleId) {
      const row = rows.get(ruleId);
      return row && row.hostId === hostId && !row.isDeleted ? TeamAssignmentRule.build(row) : null;
    },
    async create(data, transaction) {
      assert.ok(transactions.includes(transaction));
      if ([...rows.values()].some((row) =>
        row.hostId === data.hostId && row.sourceTeamId === data.sourceTeamId && row.targetTeamId === data.targetTeamId)) {
        throw new UniqueConstraintError({ errors: [] });
      }
      const row = { id: rows.size + 1, isDeleted: 0, deletedAt: null, updatedAt: null, ...data };
      rows.set(row.id, row);
      if (failWrite) throw new Error('Rule persistence failed');
      return TeamAssignmentRule.build(row);
    },
    async update(rule, data, transaction) {
      assert.ok(transactions.includes(transaction));
      const row = { ...rows.get(rule.id), ...data };
      rows.set(row.id, row);
      if (failWrite) throw new Error('Rule persistence failed');
      return TeamAssignmentRule.build(row);
    },
    async list(hostId, sourceTeamId, isEnabled) {
      return [...rows.values()].filter((row) => row.hostId === hostId && !row.isDeleted &&
        (sourceTeamId === undefined || row.sourceTeamId === sourceTeamId) &&
        (isEnabled === undefined || row.isEnabled === isEnabled)).map((row) => {
        const rule = TeamAssignmentRule.build(row);
        rule.sourceTeam = Team.build(teams.get(row.sourceTeamId));
        rule.targetTeam = Team.build(teams.get(row.targetTeamId));
        return rule;
      });
    },
  };
  const teamRepository = {
    async find(hostId, teamId, transaction) {
      assert.ok(transactions.includes(transaction));
      locks.push(teamId);
      const row = teams.get(teamId);
      return row && row.hostId === hostId && !row.isDeleted ? Team.build(row) : null;
    },
  };
  const service = new TeamAssignmentRuleService(repository, teamRepository, transactionFactory);
  const create = (fields = {}) => service.create({ ...admin, sourceTeamId: 10, targetTeamId: 20, ...fields });
  return { rows, teams, service, repository, transactions, locks, create, fail() { failWrite = true; } };
}

test('directional, multi-target, multi-source, reciprocal and same-team rules preserve independent flags', async () => {
  const h = harness();
  const rule = (await h.create({ allowCustomerAssignment: 1 })).rule;
  assert.equal(rule.sourceTeamId, 10);
  assert.equal(rule.targetTeamId, 20);
  assert.deepEqual(permissions.map((field) => rule[field]), [1, 0, 0]);
  await h.create({ targetTeamId: 30, allowScheduleVisit: 1 });
  await h.create({ sourceTeamId: 30, targetTeamId: 20, allowRescheduleVisit: 1 });
  await h.create({ sourceTeamId: 20, targetTeamId: 10 });
  const before = h.locks.length;
  const same = (await h.create({ targetTeamId: 10 })).rule;
  assert.deepEqual(h.locks.slice(before), [10], 'Same-team creation locks the team once');
  assert.deepEqual(permissions.map((field) => same[field]), [0, 0, 0]);
  assert.equal(same.isEnabled, 1);
  assert.equal(h.rows.size, 5);
  assert.deepEqual((await h.service.list({ ...admin, sourceTeamId: 10 })).rules.map((row) => row.targetTeamId), [20, 30, 10]);
});

test('duplicate non-deleted rules are rejected even when disabled', async () => {
  const h = harness();
  const { rule } = await h.create();
  await assert.rejects(h.create(), { code: 'TEAM_ASSIGNMENT_RULE_EXISTS', statusCode: 409 });
  await h.service.update({ ...admin, ruleId: rule.id, isEnabled: 0 });
  await assert.rejects(h.create(), { code: 'TEAM_ASSIGNMENT_RULE_EXISTS', statusCode: 409 });
  assert.equal(h.rows.size, 1);
});

test('updates change flags independently and enabled listing excludes disabled rules', async () => {
  const h = harness();
  const { rule } = await h.create();
  for (const field of permissions) {
    await h.service.update({ ...admin, ruleId: rule.id, [field]: 1 });
    assert.equal(h.rows.get(rule.id)[field], 1);
  }
  const updated = (await h.service.update({ ...admin, ruleId: rule.id, allowScheduleVisit: 0 })).rule;
  assert.deepEqual(permissions.map((field) => updated[field]), [1, 0, 1]);
  await h.service.update({ ...admin, ruleId: rule.id, isEnabled: 0 });
  assert.equal((await h.service.list(admin)).rules[0].isEnabled, 0);
  assert.deepEqual((await h.service.list({ ...admin, isEnabled: 1 })).rules, []);
  const enabled = (await h.service.update({ ...admin, ruleId: rule.id, isEnabled: 1 })).rule;
  assert.deepEqual(permissions.map((field) => enabled[field]), [1, 0, 1]);
  const list = await h.service.list({ ...admin, isEnabled: 1 });
  assert.equal(list.rules[0].sourceTeamName, 'Callers');
  assert.equal(list.rules[0].targetTeamName, 'Field Officers');
});

test('deleted pairs restore their unique row with fresh flags and original creation time', async () => {
  const h = harness();
  const { rule } = await h.create({ allowCustomerAssignment: 1, allowScheduleVisit: 1 });
  await h.service.remove({ ...admin, ruleId: rule.id });
  assert.equal(h.rows.get(rule.id).isEnabled, 0);
  assert.equal(h.rows.get(rule.id).isDeleted, 1);
  assert.ok(h.rows.get(rule.id).deletedAt > 0);
  assert.deepEqual((await h.service.list(admin)).rules, []);
  await assert.rejects(h.service.update({ ...admin, ruleId: rule.id, isEnabled: 1 }), { statusCode: 404 });
  const restored = (await h.create({ allowRescheduleVisit: 1 })).rule;
  assert.equal(restored.id, rule.id);
  assert.equal(restored.createdAt, rule.createdAt);
  assert.equal(restored.deletedAt, null);
  assert.equal(restored.isDeleted, 0);
  assert.deepEqual(permissions.map((field) => restored[field]), [0, 0, 1]);
  assert.equal(h.rows.size, 1);
});

test('non-admin, cross-host, missing and deleted teams/rules are rejected without modifying rows', async () => {
  const h = harness();
  const { rule } = await h.create();
  for (const fields of [{ sourceTeamId: 40 }, { targetTeamId: 40 }, { targetTeamId: 50 }, { targetTeamId: 999 }]) {
    await assert.rejects(h.create(fields), { code: 'TEAM_NOT_FOUND', statusCode: 404 });
  }
  for (const action of ['create', 'list', 'update', 'remove']) {
    await assert.rejects(h.service[action]({
      ...admin, isAdmin: false, ruleId: rule.id, sourceTeamId: 10, targetTeamId: 20, isEnabled: 0,
    }), { statusCode: 403 });
  }
  for (const action of ['update', 'remove']) {
    await assert.rejects(h.service[action]({ ...admin, hostId: 8, ruleId: rule.id, isEnabled: 0 }), { statusCode: 404 });
  }
  assert.deepEqual((await h.service.list({ ...admin, hostId: 8 })).rules, []);
  assert.equal(h.rows.size, 1);
});

test('rule validation rejects identity changes, invalid flags/IDs and empty updates', async () => {
  const h = harness();
  const { rule } = await h.create();
  for (const field of permissions) {
    for (const value of [true, '1', null, 2]) await assert.rejects(h.create({ [field]: value }), { statusCode: 400 });
  }
  for (const sourceTeamId of [true, 0, '10\n', '1e1', Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(h.create({ sourceTeamId }), { statusCode: 400 });
  }
  for (const field of ['sourceTeamId', 'targetTeamId']) {
    await assert.rejects(h.service.update({ ...admin, ruleId: rule.id, [field]: 10, isEnabled: 0 }), { statusCode: 400 });
  }
  await assert.rejects(h.service.update({ ...admin, ruleId: rule.id }), { statusCode: 400 });
  await assert.rejects(h.service.list({ ...admin, isEnabled: true }), { statusCode: 400 });
  await assert.rejects(h.create({ isEnabled: 0 }), { statusCode: 400 });
  await assert.rejects(h.service.list({ ...admin, hostId: 0 }), { statusCode: 401 });
});

test('teams lock in stable order and failed writes roll back without swallowing errors', async () => {
  const h = harness();
  await h.create({ sourceTeamId: 20, targetTeamId: 10 });
  assert.deepEqual(h.locks, [10, 20]);
  const original = structuredClone([...h.rows]);
  h.fail();
  await assert.rejects(h.create({ targetTeamId: 30 }), /Rule persistence failed/);
  await assert.rejects(h.service.update({ ...admin, ruleId: 1, isEnabled: 0 }), /Rule persistence failed/);
  assert.deepEqual([...h.rows], original);
  assert.ok(h.transactions.slice(1).every((transaction) => transaction.rolledBack && !transaction.committed));
});

test('repository scopes rule queries and both team joins; enabled filters are exact', async (t) => {
  const repository = new TeamAssignmentRuleRepository();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(TeamAssignmentRule, 'findAll', async (options) => {
    assert.deepEqual(options.where, { hostId: 7, isDeleted: 0, sourceTeamId: 10, isEnabled: 1 });
    assert.deepEqual(options.include.map((include) => include.as), ['sourceTeam', 'targetTeam']);
    assert.ok(options.include.every((include) => include.required && include.where.hostId === 7));
    return [];
  });
  await repository.list(7, 10, 1);
  const queries = [];
  t.mock.method(TeamAssignmentRule, 'findOne', async (options) => { queries.push(options); });
  await repository.find(7, 1, transaction);
  await repository.findPair(7, 10, 20, transaction);
  assert.deepEqual(queries[0].where, { id: 1, hostId: 7, isDeleted: 0 });
  assert.deepEqual(queries[1].where, { hostId: 7, sourceTeamId: 10, targetTeamId: 20 });
  assert.ok(queries.every((query) => query.transaction === transaction && query.lock === 'UPDATE'));
});

test('rule controller derives host/admin scope and preserves identity validation', async (t) => {
  const controller = new TeamAssignmentRuleController();
  const calls = [];
  t.mock.method(ruleService, 'update', async (payload) => { calls.push(payload); return { rule: { id: 1 } }; });
  const response = { json(value) { this.body = value; } };
  const fail = (error) => { throw error; };
  await controller.update({
    user: { hostId: 7, isAdminUser: 1 }, body: { hostId: 8, ruleId: 1, sourceTeamId: 10, allowScheduleVisit: 1 },
  }, response, fail);
  assert.equal(calls[0].hostId, 7);
  assert.equal(calls[0].sourceTeamId, 10);
  assert.equal(response.body.success, true);
  await controller.update({
    user: { hostId: 8, isSuperAdmin: 1 }, authContext: { isSupportSession: true },
    body: { hostId: 7, ruleId: 1, isEnabled: 0 },
  }, response, fail);
  assert.equal(calls[1].hostId, 8);
  assert.equal(calls[1].isAdmin, true);
  await controller.update({ user: { hostId: 7 }, body: { isAdmin: true } }, response, fail);
  assert.equal(calls[2].isAdmin, false);
  let error;
  await controller.update({ body: [] }, response, (value) => { error = value; });
  assert.equal(error.statusCode, 400);
});

test('assignment-rule HTTP routes enforce admin/CSRF/support policy and standard contracts', async (t) => {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const { once } = require('node:events');
  const { requireAdminRole } = require('../../src/shared/middleware/auth.middleware');
  const { requireAdminCsrfToken } = require('../../src/shared/middleware/csrf.middleware');
  const { requireSupportReadOnlyPolicy } = require('../../src/shared/middleware/support-access.middleware');
  const { getAdminCsrfCookieName } = require('../../src/shared/utils/auth-cookie.util');
  const router = require('../../src/routes/v1/admin/teams.routes').default;
  const h = harness();
  for (const action of ['create', 'list', 'update', 'remove']) {
    t.mock.method(ruleService, action, (payload) => h.service[action](payload));
  }
  const app = express();
  app.use(express.json(), cookieParser());
  app.use((req, _res, next) => {
    const auth = req.headers.authorization;
    if (auth) req.user = { hostId: 7, isAdminUser: auth === 'admin' ? 1 : 0, isSuperAdmin: auth === 'support' ? 1 : 0 };
    if (auth === 'support') req.authContext = { isSupportSession: true, accessMode: 'SUPPORT_READ_ONLY' };
    next();
  });
  app.use('/api/v1/admin', requireAdminRole, requireAdminCsrfToken, requireSupportReadOnlyPolicy);
  app.use('/api/v1/admin/teams', router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ success: false, message: error.message, code: error.code }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await once(server, 'listening');
  async function post(action, body, headers = {}) {
    const response = await fetch(`http://127.0.0.1:${server.address().port}/api/v1/admin/teams/assignment-rules/${action}`, {
      method: 'POST',
      headers: { authorization: 'admin', 'content-type': 'application/json', 'x-csrf-token': 'rule-test-csrf', cookie: `${getAdminCsrfCookieName()}=rule-test-csrf`, ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await post('list', {}, { authorization: '' })).status, 401);
  assert.equal((await post('list', {}, { authorization: 'employee' })).status, 403);
  assert.equal((await post('list', {}, { 'x-csrf-token': '' })).status, 401);
  const created = await post('create', { hostId: 8, sourceTeamId: 10, targetTeamId: 10 });
  assert.equal(created.body.data.rule.hostId, 7);
  const ruleId = created.body.data.rule.id;
  for (const [action, body] of [['list', {}], ['update', { ruleId, allowCustomerAssignment: 1 }], ['delete', { ruleId }]]) {
    const result = await post(action, body);
    assert.equal(result.status, 200);
    assert.equal(result.body.success, true);
    assert.equal(typeof result.body.message, 'string');
    assert.ok(Object.hasOwn(result.body, 'data'));
  }
  assert.equal((await post('list', {}, { authorization: 'support' })).status, 200);
  for (const action of ['create', 'update', 'delete']) assert.equal((await post(action, {}, { authorization: 'support' })).status, 403);
});
