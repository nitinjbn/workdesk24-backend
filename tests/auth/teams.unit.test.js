const test = require('node:test');
const assert = require('node:assert/strict');
process.env.NODE_ENV = 'test';
process.env.DB_HOST = '127.0.0.1';
process.env.DB_PORT = '3306';
process.env.DB_NAME_TEST = 'wd_team_unit_test';
const { Op, UniqueConstraintError } = require('sequelize');
const { Team, TeamMember, User, sequelize } = require('../../src/models');
const { TeamService } = require('../../src/modules/auth/services/team.service');
const teamService = require('../../src/modules/auth/services/team.service').default;
const { TeamRepository } = require('../../src/modules/auth/repositories/team.repository');
const { TeamController } = require('../../src/modules/admin/controllers/team.controller');

test.before(() => test.mock.method(sequelize, 'query', async () => { throw new Error('Unexpected database query'); }));
test.after(() => sequelize.close());

const admin = { hostId: 7, isAdmin: true };

function harness() {
  const teams = new Map();
  const members = new Map();
  const users = new Map([
    [22, { id: 22, hostId: 7, name: 'Alice', isDeleted: 0 }],
    [23, { id: 23, hostId: 8, name: 'Foreign User', isDeleted: 0 }],
    [24, { id: 24, hostId: 7, name: 'Deleted User', isDeleted: 1 }],
  ]);
  const transactions = [];
  let failWrite = false;
  const transactionFactory = async () => {
    const snapshot = structuredClone({ teams: [...teams], members: [...members] });
    const transaction = {
      committed: false, rolledBack: false,
      async commit() { this.committed = true; },
      async rollback() {
        this.rolledBack = true;
        teams.clear();
        members.clear();
        for (const [id, row] of snapshot.teams) teams.set(id, row);
        for (const [id, row] of snapshot.members) members.set(id, row);
      },
    };
    transactions.push(transaction);
    return transaction;
  };
  const duplicateName = (data, excluding) => {
    if (!data.isDeleted && [...teams.values()].some((team) =>
      !team.isDeleted && team.id !== excluding && team.hostId === data.hostId &&
      team.teamName.toLowerCase() === data.teamName.toLowerCase())) {
      throw new UniqueConstraintError({ errors: [] });
    }
  };
  const repository = {
    async create(data) {
      const row = { id: teams.size + 1, isDeleted: 0, updatedAt: null, deletedAt: null, ...data };
      duplicateName(row);
      teams.set(row.id, row);
      return Team.build(row);
    },
    async find(hostId, teamId) {
      const row = teams.get(teamId);
      return row && row.hostId === hostId && !row.isDeleted ? Team.build(row) : null;
    },
    async list(hostId, page, limit, search) {
      const rows = [...teams.values()].filter((row) =>
        row.hostId === hostId && !row.isDeleted &&
        (!search || row.teamName.toLowerCase().includes(search.toLowerCase())))
        .sort((a, b) => a.teamName.localeCompare(b.teamName) || a.id - b.id);
      return { rows: rows.slice((page - 1) * limit, page * limit).map((row) => Team.build(row)), count: rows.length };
    },
    async update(team, data, transaction) {
      assert.ok(transactions.includes(transaction));
      const row = { ...teams.get(team.id), ...data };
      duplicateName(row, team.id);
      teams.set(team.id, row);
      if (failWrite) throw new Error('Persistence failed');
      return Team.build(row);
    },
    async findUser(hostId, userId) {
      const row = users.get(userId);
      return row && row.hostId === hostId ? row : null;
    },
    async findMember(hostId, teamId, userId) {
      const row = [...members.values()].find((member) =>
        member.hostId === hostId && member.teamId === teamId && member.userId === userId);
      return row ? TeamMember.build(row) : null;
    },
    async listMembers(hostId, teamId) {
      return [...members.values()].filter((row) => row.hostId === hostId && row.teamId === teamId)
        .map((row) => TeamMember.build(row));
    },
    async createMember(data, transaction) {
      assert.ok(transactions.includes(transaction));
      assert.ok(![...members.values()].some((row) =>
        row.hostId === data.hostId && row.teamId === data.teamId && row.userId === data.userId));
      const row = { id: members.size + 1, updatedAt: null, ...data };
      members.set(row.id, row);
      if (failWrite) throw new Error('Persistence failed');
      return TeamMember.build(row);
    },
    async updateMember(member, isEnabled, transaction) {
      assert.ok(transactions.includes(transaction));
      const row = { ...members.get(member.id), isEnabled, updatedAt: Math.floor(Date.now() / 1000) };
      members.set(row.id, row);
      if (failWrite) throw new Error('Persistence failed');
      return TeamMember.build(row);
    },
  };
  const service = new TeamService(repository, transactionFactory);
  const create = (teamName = 'Telecallers', scope = admin) => service.create({ ...scope, teamName });
  const add = (teamId, userId = 22, scope = admin) => service.addMember({ ...scope, teamId, userId });
  return { service, repository, teams, members, users, transactions, create, add, fail() { failWrite = true; } };
}

test('team creation trims names, defaults status, and lists searched/paginated host teams', async () => {
  const h = harness();
  const team = (await h.create(' Telecallers ')).team;
  assert.equal(team.teamName, 'Telecallers');
  assert.equal(team.hostId, 7);
  assert.equal(team.isEnabled, 1);
  await h.create('Field Officers');
  await h.create('Foreign', { ...admin, hostId: 8 });
  const list = await h.service.list({ ...admin, page: 2, limit: 1 });
  assert.deepEqual(list.teams.map((row) => row.teamName), ['Telecallers']);
  assert.deepEqual(list.pagination, { total: 2, page: 2, limit: 1, totalPages: 2 });
  assert.equal((await h.service.list({ ...admin, search: ' call ' })).teams.length, 1);
  assert.deepEqual((await h.service.list({ ...admin, search: 'missing' })).teams, []);
});

test('names are host-scoped, reserved while disabled, and reusable after soft deletion without cascading', async () => {
  const h = harness();
  const { team } = await h.create();
  const { member } = await h.add(team.id);
  await assert.rejects(h.create('telecallers'), { code: 'TEAM_NAME_EXISTS', statusCode: 409 });
  await h.create('Telecallers', { ...admin, hostId: 8 });
  await h.service.update({ ...admin, teamId: team.id, isEnabled: 0 });
  await assert.rejects(h.create('TELECALLERS'), { code: 'TEAM_NAME_EXISTS' });
  await h.service.update({ ...admin, teamId: team.id, teamName: ' Calling ', isEnabled: 1 });
  assert.equal(h.teams.get(team.id).teamName, 'Calling');
  const another = (await h.create('Another')).team;
  await assert.rejects(h.service.update({ ...admin, teamId: another.id, teamName: 'calling' }), { statusCode: 409 });
  const originalMember = structuredClone(h.members.get(member.id));
  await h.service.remove({ ...admin, teamId: team.id });
  assert.equal(h.teams.get(team.id).isDeleted, 1);
  assert.ok(h.teams.get(team.id).deletedAt > 0);
  assert.deepEqual(h.members.get(member.id), originalMember);
  const replacement = (await h.create('Calling')).team;
  assert.notEqual(replacement.id, team.id);
  assert.deepEqual((await h.service.detail({ ...admin, teamId: replacement.id })).members, []);
});

test('one user joins multiple teams; duplicate membership is rejected and disabled rows reactivate', async () => {
  const h = harness();
  const first = (await h.create()).team.id;
  const second = (await h.create('Field Officers')).team.id;
  const initial = (await h.add(first)).member;
  await h.add(second);
  assert.equal(h.members.size, 2);
  await assert.rejects(h.add(first), { code: 'TEAM_MEMBER_EXISTS', statusCode: 409 });
  assert.equal(h.members.size, 2);
  await h.service.removeMember({ ...admin, teamId: first, userId: 22 });
  assert.equal(h.members.get(initial.id).isEnabled, 0);
  const reactivated = (await h.add(first)).member;
  assert.equal(reactivated.id, initial.id);
  assert.equal(reactivated.createdAt, initial.createdAt);
  assert.equal(reactivated.isEnabled, 1);
  assert.equal(h.members.size, 2);
  assert.equal((await h.service.detail({ ...admin, teamId: first })).members.length, 1);
});

test('membership update enables/disables only the identified row; removal is non-destructive', async () => {
  const h = harness();
  const teamId = (await h.create()).team.id;
  const { member } = await h.add(teamId);
  for (const isEnabled of [0, 1]) {
    const updated = await h.service.updateMember({ ...admin, teamId, userId: 22, isEnabled, id: 999 });
    assert.equal(updated.member.isEnabled, isEnabled);
    for (const key of ['id', 'hostId', 'teamId', 'userId', 'createdAt']) assert.equal(updated.member[key], member[key]);
  }
  await h.service.removeMember({ ...admin, teamId, userId: 22 });
  await h.service.removeMember({ ...admin, teamId, userId: 22 });
  assert.equal(h.members.size, 1);
  assert.equal((await h.service.listMembers({ ...admin, teamId })).members[0].isEnabled, 0);
  h.users.get(22).isDeleted = 1;
  await assert.rejects(h.add(teamId), { code: 'TEAM_USER_NOT_FOUND' });
  await h.service.removeMember({ ...admin, teamId, userId: 22 });
});

test('membership arrays add, deduplicate, reactivate, update and remove atomically while preserving scalar responses', async () => {
  const h = harness();
  h.users.set(25, { id: 25, hostId: 7, isDeleted: 0 });
  const teamId = (await h.create()).team.id;
  const original = (await h.add(teamId, 22)).member;
  await h.service.removeMember({ ...admin, teamId, userId: 22 });
  const beforeTransactions = h.transactions.length;
  const added = await h.add(teamId, [25, 22, 25]);
  assert.deepEqual(added.members.map((member) => member.userId), [22, 25]);
  assert.equal(Object.hasOwn(added, 'member'), false);
  assert.equal(added.members[0].id, original.id);
  assert.equal(added.members[0].createdAt, original.createdAt);
  assert.equal(h.transactions.length, beforeTransactions + 1);
  for (const isEnabled of [0, 1]) {
    const updated = await h.service.updateMember({ ...admin, teamId, userId: [25, 22, 22], isEnabled });
    assert.equal(updated.members.length, 2);
    assert.ok(updated.members.every((member) => member.isEnabled === isEnabled));
  }
  const removed = await h.service.removeMember({ ...admin, teamId, userId: [22, 25] });
  assert.ok(removed.members.every((member) => member.isEnabled === 0));
  assert.equal(h.members.size, 2);
  const scalar = await h.add(teamId, 22);
  assert.equal(scalar.member.userId, 22);
  assert.equal(Object.hasOwn(scalar, 'members'), false);
  assert.equal((await h.service.updateMember({ ...admin, teamId, userId: [22], isEnabled: 0 })).members.length, 1);
});

test('invalid membership arrays fail before opening a transaction for every mutation', async () => {
  const h = harness();
  const teamId = (await h.create()).team.id;
  for (const action of ['addMember', 'updateMember', 'removeMember']) {
    for (const userId of [[], [22, 0], [22, true], [[22]], [22, null], [22, 1.5], [22, {}], [22, Number.MAX_SAFE_INTEGER + 1]]) {
      await assert.rejects(h.service[action]({ ...admin, teamId, userId, isEnabled: 1 }), { code: 'VALIDATION_ERROR', statusCode: 400 });
    }
  }
  assert.equal(h.transactions.length, 0);
  assert.equal(h.members.size, 0);
});

test('batch add rolls back earlier additions for foreign users and existing enabled memberships', async () => {
  const h = harness();
  h.users.set(25, { id: 25, hostId: 7, isDeleted: 0 });
  const teamId = (await h.create()).team.id;
  await assert.rejects(h.add(teamId, [22, 23]), { code: 'TEAM_USER_NOT_FOUND' });
  assert.equal(h.members.size, 0);
  await h.add(teamId, 25);
  const before = structuredClone([...h.members]);
  await assert.rejects(h.add(teamId, [22, 25]), { code: 'TEAM_MEMBER_EXISTS', statusCode: 409 });
  assert.deepEqual([...h.members], before);
  for (const action of ['addMember', 'updateMember', 'removeMember']) {
    await assert.rejects(h.service[action]({ ...admin, hostId: 8, teamId, userId: [23], isEnabled: 0 }), { code: 'TEAM_NOT_FOUND' });
  }
  assert.ok(h.transactions.slice(0, 1).concat(h.transactions.slice(2)).every((transaction) => transaction.rolledBack));
});

test('batch update and remove roll back earlier changes when a later membership is missing', async () => {
  const h = harness();
  h.users.set(25, { id: 25, hostId: 7, isDeleted: 0 });
  const teamId = (await h.create()).team.id;
  await h.add(teamId, 22);
  const before = structuredClone([...h.members]);
  for (const action of ['updateMember', 'removeMember']) {
    await assert.rejects(h.service[action]({ ...admin, teamId, userId: [22, 25], isEnabled: 0 }), { code: 'TEAM_MEMBER_NOT_FOUND', statusCode: 404 });
    assert.deepEqual([...h.members], before);
  }
});

test('batch write failures roll back all members and use stable user lock ordering', async () => {
  const h = harness();
  h.users.set(25, { id: 25, hostId: 7, isDeleted: 0 });
  const teamId = (await h.create()).team.id;
  const lockedUsers = [];
  const findUser = h.repository.findUser;
  h.repository.findUser = async (...args) => {
    lockedUsers.push(args[1]);
    return findUser(...args);
  };
  const createMember = h.repository.createMember;
  const failure = new Error('Second member write failed');
  h.repository.createMember = async (...args) => {
    const member = await createMember(...args);
    if (member.userId === 25) throw failure;
    return member;
  };
  await assert.rejects(h.add(teamId, [25, 22]), (error) => error === failure);
  assert.deepEqual(lockedUsers, [22, 25]);
  assert.equal(h.members.size, 0);
  assert.ok(h.transactions[0].rolledBack && !h.transactions[0].committed);
});

test('membership errors identify the affected user for scalar and array requests without leaking foreign names', async () => {
  const h = harness();
  h.users.set(25, { id: 25, hostId: 7, name: 'Bob', isDeleted: 0 });
  const teamId = (await h.create()).team.id;
  await h.add(teamId, 22);
  for (const userId of [22, [22, 25]]) {
    await assert.rejects(h.add(teamId, userId), {
      code: 'TEAM_MEMBER_EXISTS', statusCode: 409,
      message: 'Alice is already a member of this team',
    });
  }
  for (const action of ['updateMember', 'removeMember']) {
    for (const userId of [25, [22, 25]]) {
      await assert.rejects(h.service[action]({ ...admin, teamId, userId, isEnabled: 0 }), {
        code: 'TEAM_MEMBER_NOT_FOUND', statusCode: 404,
        message: 'Team membership not found for Bob',
      });
    }
    assert.equal([...h.members.values()][0].isEnabled, 1);
  }
  await assert.rejects(h.add(teamId, [22, 23]), { code: 'TEAM_MEMBER_EXISTS' });
  for (const action of ['addMember', 'updateMember', 'removeMember']) {
    for (const userId of [23, [23]]) {
      await assert.rejects(h.service[action]({ ...admin, teamId, userId, isEnabled: 0 }), {
        code: 'TEAM_USER_NOT_FOUND', message: 'User is unavailable in this host',
      });
    }
  }
  await h.service.removeMember({ ...admin, teamId, userId: 22 });
  h.repository.createMember = async () => { throw new UniqueConstraintError({ errors: [] }); };
  await assert.rejects(h.add(teamId, [22, 25]), {
    code: 'TEAM_MEMBER_EXISTS', message: 'Bob is already a member of this team',
  });
  assert.equal([...h.members.values()][0].isEnabled, 0);
});

test('all operations reject non-admins and foreign/deleted teams; membership rejects foreign users', async () => {
  const h = harness();
  const teamId = (await h.create()).team.id;
  for (const action of ['create', 'list', 'detail', 'update', 'remove', 'listMembers', 'addMember', 'updateMember', 'removeMember']) {
    await assert.rejects(h.service[action]({ ...admin, isAdmin: false, teamId, userId: 22, teamName: 'Other', isEnabled: 0 }), { statusCode: 403 });
  }
  for (const action of ['detail', 'update', 'remove', 'listMembers', 'addMember', 'updateMember', 'removeMember']) {
    await assert.rejects(h.service[action]({ ...admin, hostId: 8, teamId, userId: 23, teamName: 'Other', isEnabled: 0 }), { code: 'TEAM_NOT_FOUND', statusCode: 404 });
  }
  for (const userId of [23, 24, 999]) await assert.rejects(h.add(teamId, userId), { code: 'TEAM_USER_NOT_FOUND' });
  await assert.rejects(h.service.updateMember({ ...admin, teamId, userId: 22, isEnabled: 1 }), { code: 'TEAM_MEMBER_NOT_FOUND' });
  await h.service.remove({ ...admin, teamId });
  await assert.rejects(h.add(teamId), { code: 'TEAM_NOT_FOUND' });
  assert.equal(h.members.size, 0);
});

test('malformed names, identifiers, flags, pagination and absent update fields fail explicitly', async () => {
  const h = harness();
  for (const teamName of ['', ' ', null, 2, 'a'.repeat(101)]) {
    await assert.rejects(h.service.create({ ...admin, teamName }), { statusCode: 400 });
  }
  for (const teamId of [0, -1, true, '1\n', '1e2', [], 1.5, Number.MAX_SAFE_INTEGER + 1]) {
    await assert.rejects(h.service.detail({ ...admin, teamId }), { statusCode: 400 });
  }
  const teamId = (await h.create()).team.id;
  for (const isEnabled of [true, null, 2, '1', undefined]) {
    await assert.rejects(h.service.updateMember({ ...admin, teamId, userId: 22, isEnabled }), { statusCode: 400 });
  }
  for (const fields of [{ limit: 101 }, { page: 0 }, { page: '1\n' }, { search: false }, { limit: 100, page: Number.MAX_SAFE_INTEGER }]) {
    await assert.rejects(h.service.list({ ...admin, ...fields }), { statusCode: 400 });
  }
  await assert.rejects(h.service.update({ ...admin, teamId }), { statusCode: 400 });
  await assert.rejects(h.service.list({ ...admin, hostId: 0 }), { statusCode: 401 });
});

test('failed writes roll back membership/team mutations and preserve original persistence errors', async () => {
  const h = harness();
  const teamId = (await h.create()).team.id;
  const original = structuredClone([...h.teams]);
  h.fail();
  await assert.rejects(h.add(teamId), /Persistence failed/);
  assert.equal(h.members.size, 0);
  await assert.rejects(h.service.update({ ...admin, teamId, teamName: 'Changed' }), /Persistence failed/);
  assert.deepEqual([...h.teams], original);
  assert.ok(h.transactions.every((transaction) => transaction.rolledBack && !transaction.committed));
});

test('repository lookups and joins enforce host scope and mutations take transaction locks', async (t) => {
  const repository = new TeamRepository();
  const transaction = { LOCK: { UPDATE: 'UPDATE' } };
  t.mock.method(Team, 'findOne', async (options) => {
    assert.deepEqual(options.where, { id: 12, hostId: 7, isDeleted: 0 });
    assert.equal(options.lock, 'UPDATE');
    assert.equal(options.transaction, transaction);
  });
  await repository.find(7, 12, transaction);
  t.mock.method(User, 'findOne', async (options) => {
    assert.deepEqual(options.where, { id: 22, hostId: 7 });
    assert.ok(options.attributes.includes('name'));
    assert.equal(options.lock, 'UPDATE');
  });
  await repository.findUser(7, 22, transaction);
  t.mock.method(TeamMember, 'findOne', async (options) => {
    assert.deepEqual(options.where, { hostId: 7, teamId: 12, userId: 22 });
    assert.equal(options.transaction, transaction);
    assert.equal(options.lock, 'UPDATE');
  });
  await repository.findMember(7, 12, 22, transaction);
  t.mock.method(TeamMember, 'findAll', async (options) => {
    assert.deepEqual(options.where, { hostId: 7, teamId: 12 });
    assert.deepEqual(options.include[0].where, { hostId: 7 });
    assert.ok(!options.include[0].attributes.includes('password'));
  });
  await repository.listMembers(7, 12);
  t.mock.method(Team, 'findAndCountAll', async (options) => {
    assert.equal(options.where.hostId, 7);
    assert.equal(options.where.isDeleted, 0);
    assert.equal(options.where.teamName[Op.like], '%call%');
    assert.equal(options.limit, 10);
    assert.equal(options.offset, 10);
  });
  await repository.list(7, 2, 10, 'call');
});

test('controllers ignore client host/admin flags, honor switched context, and reject invalid bodies', async (t) => {
  const controller = new TeamController();
  const calls = [];
  t.mock.method(teamService, 'create', async (payload) => { calls.push(payload); return { team: { hostId: payload.hostId } }; });
  const response = { json(value) { this.body = value; } };
  const fail = (error) => { throw error; };
  await controller.create({
    body: { teamName: 'Telecallers', hostId: 8, isAdmin: true },
    user: { hostId: 7, isAdminUser: 1 },
  }, response, fail);
  assert.equal(calls[0].hostId, 7);
  assert.equal(response.body.success, true);
  assert.ok(response.body.message);
  await controller.create({
    body: { hostId: 999 }, user: { hostId: 8, isSuperAdmin: 1 },
    authContext: { isSupportSession: true, currentHostId: 8 },
  }, response, fail);
  assert.equal(calls[1].hostId, 8);
  assert.equal(calls[1].isAdmin, true);
  await controller.create({ body: { isAdmin: true }, user: { hostId: 7 } }, response, fail);
  assert.equal(calls[2].isAdmin, false);
  let error;
  await controller.create({ body: [], user: { hostId: 7 } }, response, (value) => { error = value; });
  assert.equal(error.statusCode, 400);
});

test('all nine HTTP endpoints use existing admin authorization/CSRF and standard responses', async (t) => {
  const express = require('express');
  const cookieParser = require('cookie-parser');
  const { once } = require('node:events');
  const { requireAdminRole } = require('../../src/shared/middleware/auth.middleware');
  const { requireAdminCsrfToken } = require('../../src/shared/middleware/csrf.middleware');
  const { getAdminCsrfCookieName } = require('../../src/shared/utils/auth-cookie.util');
  const router = require('../../src/routes/v1/admin/teams.routes').default;
  const h = harness();
  for (const action of ['create', 'list', 'detail', 'update', 'remove', 'listMembers', 'addMember', 'updateMember', 'removeMember']) {
    t.mock.method(teamService, action, (payload) => h.service[action](payload));
  }
  const app = express();
  app.use(express.json(), cookieParser());
  app.use((req, _res, next) => {
    if (req.headers.authorization) req.user = { hostId: 7, isAdminUser: req.headers.authorization === 'admin' ? 1 : 0 };
    next();
  });
  app.use('/api/v1/admin/teams', requireAdminRole, requireAdminCsrfToken, router);
  app.use((error, _req, res, _next) => res.status(error.statusCode || 500).json({ success: false, message: error.message, code: error.code }));
  const server = app.listen(0, '127.0.0.1');
  t.after(() => new Promise((resolve, reject) => server.close((error) => error ? reject(error) : resolve())));
  await once(server, 'listening');
  const url = `http://127.0.0.1:${server.address().port}/api/v1/admin/teams`;
  async function post(path, body, headers = {}) {
    const response = await fetch(`${url}/${path}`, {
      method: 'POST',
      headers: { authorization: 'admin', 'content-type': 'application/json', 'x-csrf-token': 'team-test-csrf', cookie: `${getAdminCsrfCookieName()}=team-test-csrf`, ...headers },
      body: JSON.stringify(body),
    });
    return { status: response.status, body: await response.json() };
  }
  assert.equal((await post('list', {}, { authorization: '' })).status, 401);
  assert.equal((await post('list', {}, { authorization: 'employee' })).status, 403);
  assert.equal((await post('list', {}, { 'x-csrf-token': '' })).status, 401);
  const created = await post('create', { teamName: 'Callers', hostId: 999 });
  assert.equal(created.body.data.team.hostId, 7);
  const teamId = created.body.data.team.id;
  h.users.set(25, { id: 25, hostId: 7, isDeleted: 0 });
  const batchAdded = await post('members/add', { teamId, userId: [25, 22, 25], hostId: 999 });
  assert.equal(batchAdded.status, 200);
  assert.deepEqual(batchAdded.body.data.members.map((member) => member.userId), [22, 25]);
  assert.ok(batchAdded.body.data.members.every((member) => member.hostId === 7));
  const duplicate = await post('members/add', { teamId, userId: 22 });
  assert.equal(duplicate.status, 409);
  assert.equal(duplicate.body.message, 'Alice is already a member of this team');
  h.users.set(26, { id: 26, hostId: 7, name: 'Charlie', isDeleted: 0 });
  for (const path of ['members/update', 'members/remove']) {
    const missing = await post(path, { teamId, userId: [22, 26], isEnabled: 0 });
    assert.equal(missing.status, 404);
    assert.equal(missing.body.message, 'Team membership not found for Charlie');
    assert.equal(h.members.get(batchAdded.body.data.members[0].id).isEnabled, 1);
  }
  for (const path of ['members/update', 'members/remove']) {
    const result = await post(path, { teamId, userId: [22, 25], isEnabled: 0 });
    assert.equal(result.status, 200);
    assert.ok(result.body.data.members.every((member) => member.isEnabled === 0));
  }
  const invalidBatch = await post('members/add', { teamId, userId: [22, 23] });
  assert.equal(invalidBatch.status, 404);
  assert.equal(h.members.get(batchAdded.body.data.members[0].id).isEnabled, 0);
  for (const [path, body] of [
    ['list', {}], ['detail', { teamId }], ['update', { teamId, isEnabled: 0 }],
    ['members/add', { teamId, userId: 22 }], ['members/list', { teamId }],
    ['members/update', { teamId, userId: 22, isEnabled: 0 }], ['members/remove', { teamId, userId: 22 }],
    ['delete', { teamId }],
  ]) {
    const result = await post(path, body);
    assert.equal(result.status, 200, path);
    assert.equal(result.body.success, true, path);
    assert.equal(typeof result.body.message, 'string');
    assert.ok(Object.hasOwn(result.body, 'data'));
  }
  assert.equal((await post('detail', { teamId })).status, 404);
});
