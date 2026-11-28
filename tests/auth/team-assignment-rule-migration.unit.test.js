const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const Sequelize = require('sequelize');
const migration = require('../../src/migrations/20261128100000-create-team-assignment-rules');

test('rule migration creates only the rule table and resumes indexes after partial DDL failure', async () => {
  let columns;
  let failOnce = true;
  const indexes = [];
  const queryInterface = {
    async showAllTables() { return columns ? ['wd_team_assignment_rules'] : []; },
    async createTable(name, fields) {
      assert.equal(name, 'wd_team_assignment_rules');
      assert.equal(columns, undefined);
      columns = fields;
    },
    async showIndex() { return indexes; },
    async addIndex(_table, fields, options) {
      if (failOnce) { failOnce = false; throw new Error('Interrupted DDL'); }
      assert.ok(!indexes.some((index) => index.name === options.name));
      indexes.push({ fields, ...options });
    },
  };
  await assert.rejects(migration.up(queryInterface, Sequelize), /Interrupted DDL/);
  await migration.up(queryInterface, Sequelize);
  await migration.up(queryInterface, Sequelize);
  assert.deepEqual(indexes.filter((index) => index.unique).map((index) => index.fields), [['hostId', 'sourceTeamId', 'targetTeamId']]);
  assert.ok(indexes.some((index) => index.fields.join(',') === 'hostId,sourceTeamId,isDeleted,isEnabled'));
  for (const field of ['allowCustomerAssignment', 'allowScheduleVisit', 'allowRescheduleVisit']) {
    assert.equal(columns[field].defaultValue, 0);
    assert.equal(columns[field].allowNull, false);
  }
  assert.equal(columns.isEnabled.defaultValue, 1);
  for (const [field, parent] of [['hostId', 'wd_hosts'], ['sourceTeamId', 'wd_teams'], ['targetTeamId', 'wd_teams']]) {
    assert.equal(columns[field].references.model, parent);
    assert.equal(columns[field].onDelete, 'RESTRICT');
  }
  await assert.rejects(migration.down(), /destructive rollback is not supported/);
});

test('Postman rule endpoints include valid request fields and existing admin authentication/CSRF headers', () => {
  const collection = JSON.parse(fs.readFileSync(path.join(__dirname, '../../Workdesk24_API_v3.postman_collection.json'), 'utf8'));
  const endpoints = collection.item.find((folder) => folder.name === 'Admin').item.find((folder) => folder.name === 'Team Assignment Rules').item;
  assert.deepEqual(endpoints.map((item) => item.request.url.path.at(-1)), ['create', 'list', 'update', 'delete']);
  for (const { request } of endpoints) {
    assert.equal(request.method, 'POST');
    assert.ok(request.header.some((header) => header.key === 'Authorization'));
    assert.ok(request.header.some((header) => header.key === 'x-csrf-token'));
    assert.ok(request.header.some((header) => header.key === 'Cookie'));
    assert.equal(Object.hasOwn(JSON.parse(request.body.raw), 'hostId'), false);
    assert.match(request.url.raw, /\/api\/v1\/admin\/teams\/assignment-rules\//);
  }
});
