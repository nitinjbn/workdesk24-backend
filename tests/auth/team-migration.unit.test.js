const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Sequelize = require('sequelize');
const migration = require('../../src/migrations/20261128090000-create-team-tables');

test('team migration installs host-name and membership constraints and can resume after partial DDL failure', async () => {
  const tables = new Map();
  const indexes = new Map();
  const sql = [];
  let failOnce = true;
  const queryInterface = {
    async showAllTables() { return [...tables.keys()]; },
    async createTable(name, columns, options) {
      assert.ok(!tables.has(name), 'Do not recreate committed tables');
      assert.equal(options.collate, 'utf8mb4_unicode_ci');
      tables.set(name, { ...columns });
      indexes.set(name, []);
    },
    async describeTable(name) { return tables.get(name); },
    async showIndex(name) { return indexes.get(name); },
    async addIndex(name, fields, options) {
      if (name === 'wd_team_members' && failOnce) {
        failOnce = false;
        throw new Error('Interrupted DDL');
      }
      assert.ok(!indexes.get(name).some((index) => index.name === options.name));
      indexes.get(name).push({ fields, ...options });
    },
    sequelize: {
      async query(statement) {
        sql.push(statement);
        assert.match(statement, /GENERATED ALWAYS AS \(CASE WHEN isDeleted = 0 THEN teamName ELSE NULL END\) STORED/);
        tables.get('wd_teams').activeTeamName = {};
      },
    },
  };
  await assert.rejects(migration.up(queryInterface, Sequelize), /Interrupted DDL/);
  await migration.up(queryInterface, Sequelize);
  await migration.up(queryInterface, Sequelize);
  assert.equal(sql.length, 1);
  const teamIndexes = indexes.get('wd_teams');
  assert.deepEqual(teamIndexes.find((index) => index.unique).fields, ['hostId', 'activeTeamName']);
  const memberIndexes = indexes.get('wd_team_members');
  assert.deepEqual(memberIndexes.filter((index) => index.unique).map((index) => index.fields), [['hostId', 'teamId', 'userId']]);
  const team = tables.get('wd_teams');
  const member = tables.get('wd_team_members');
  assert.ok(team.deletedAt);
  assert.ok(!member.isDeleted && !member.deletedAt);
  for (const [columns, field, parent] of [
    [team, 'hostId', 'wd_hosts'], [member, 'hostId', 'wd_hosts'],
    [member, 'teamId', 'wd_teams'], [member, 'userId', 'wd_users'],
  ]) {
    assert.equal(columns[field].references.model, parent);
    assert.equal(columns[field].onDelete, 'RESTRICT');
    assert.equal(columns[field].onUpdate, 'CASCADE');
  }
  await assert.rejects(migration.down(), /destructive rollback is not supported/);
});

test('Postman team endpoints include admin/CSRF headers and valid scoped request contracts', () => {
  const collection = JSON.parse(fs.readFileSync(path.join(__dirname, '../../Workdesk24_API_v3.postman_collection.json'), 'utf8'));
  const endpoints = collection.item.find((folder) => folder.name === 'Admin').item.find((folder) => folder.name === 'Teams').item;
  assert.deepEqual(endpoints.map((item) => item.request.url.path.slice(4).join('/')), [
    'create', 'list', 'detail', 'update', 'delete', 'members/list', 'members/add', 'members/update', 'members/remove',
  ]);
  for (const { request } of endpoints) {
    assert.equal(request.method, 'POST');
    assert.ok(request.header.some((header) => header.key === 'Authorization'));
    assert.ok(request.header.some((header) => header.key === 'x-csrf-token'));
    assert.ok(request.header.some((header) => header.key === 'Cookie'));
    assert.equal(Object.hasOwn(JSON.parse(request.body.raw), 'hostId'), false);
    assert.match(request.url.raw, /\/api\/v1\/admin\/teams\//);
  }
});
