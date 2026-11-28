const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const Sequelize = require('sequelize');

test('private MySQL validates assignment-rule migration and persistence without changing Phase 2 records', {
  skip: !process.env.TEAM_TEST_MYSQL_SOCKET ? 'Requires TEAM_TEST_MYSQL_SOCKET for an isolated MySQL instance' : false,
}, async (t) => {
  const database = `wd_rule_test_${randomUUID().replaceAll('-', '')}`;
  const options = {
    dialect: 'mysql', dialectOptions: { socketPath: process.env.TEAM_TEST_MYSQL_SOCKET },
    logging: false, pool: { max: 5, min: 0, idle: 1000 },
  };
  const connection = new Sequelize.Sequelize('', 'root', '', options);
  let db;
  let applicationDb;
  try {
    await connection.query(`CREATE DATABASE \`${database}\``);
    db = new Sequelize.Sequelize(database, 'root', '', options);
    const qi = db.getQueryInterface();
    await qi.createTable('wd_hosts', { id: { type: Sequelize.BIGINT, primaryKey: true } });
    await qi.createTable('wd_users', {
      id: { type: Sequelize.BIGINT, primaryKey: true },
      hostId: { type: Sequelize.BIGINT },
    });
    await db.query('INSERT INTO wd_hosts (id) VALUES (7), (8)');
    const teamMigration = require('../../src/migrations/20261128090000-create-team-tables');
    await teamMigration.up(qi, Sequelize);
    await db.query(`INSERT INTO wd_teams (id, hostId, teamName, createdAt) VALUES
      (10, 7, 'Callers', 1), (20, 7, 'Field Officers', 1), (30, 7, 'Support', 1), (40, 8, 'Foreign', 1)`);
    const [originalTeams] = await db.query('SELECT * FROM wd_teams ORDER BY id');
    const ruleMigration = require('../../src/migrations/20261128100000-create-team-assignment-rules');
    await ruleMigration.up(qi, Sequelize);
    await ruleMigration.up(qi, Sequelize);
    const ruleIndexes = await qi.showIndex('wd_team_assignment_rules');
    assert.deepEqual(ruleIndexes.filter((index) => index.unique && !index.primary).map((index) =>
      index.fields.map((field) => field.attribute)), [['hostId', 'sourceTeamId', 'targetTeamId']]);

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3306';
    process.env.DB_NAME_TEST = database;
    const models = require('../../src/models');
    applicationDb = models.sequelize;
    t.mock.method(applicationDb, 'query', async () => { throw new Error('Unexpected shared database query'); });
    const { initTeam } = require('../../src/models/schemas/Team');
    const { initTeamAssignmentRule } = require('../../src/models/schemas/TeamAssignmentRule');
    const Team = initTeam(db);
    const Rule = initTeamAssignmentRule(db);
    Rule.associate({ Team, Host: models.Host });
    const { TeamAssignmentRuleRepository } = require('../../src/modules/auth/repositories/team-assignment-rule.repository');
    const { TeamRepository } = require('../../src/modules/auth/repositories/team.repository');
    const { TeamAssignmentRuleService } = require('../../src/modules/auth/services/team-assignment-rule.service');
    const service = new TeamAssignmentRuleService(new TeamAssignmentRuleRepository(), new TeamRepository(), () => db.transaction());
    const admin = { hostId: 7, isAdmin: true };
    const create = (fields = {}) => service.create({ ...admin, sourceTeamId: 10, targetTeamId: 20, ...fields });
    let rule;

    await t.test('many-to-many, reciprocal and same-team rules persist while active duplicates are rejected', async () => {
      const results = await Promise.allSettled([create(), create()]);
      assert.equal(results.filter((result) => result.status === 'fulfilled').length, 1);
      assert.equal(results.find((result) => result.status === 'rejected').reason.code, 'TEAM_ASSIGNMENT_RULE_EXISTS');
      rule = results.find((result) => result.status === 'fulfilled').value.rule;
      await create({ targetTeamId: 30, allowScheduleVisit: 1 });
      await create({ sourceTeamId: 30, targetTeamId: 20, allowRescheduleVisit: 1 });
      await create({ sourceTeamId: 20, targetTeamId: 10, allowCustomerAssignment: 1 });
      const same = (await create({ targetTeamId: 10 })).rule;
      assert.deepEqual([same.allowCustomerAssignment, same.allowScheduleVisit, same.allowRescheduleVisit], [0, 0, 0]);
      assert.equal(await Rule.count(), 5);
      await assert.rejects(Rule.create({ hostId: 7, sourceTeamId: 10, targetTeamId: 20, createdAt: 1 }), Sequelize.UniqueConstraintError);
    });

    await t.test('independent flag changes and enabled filtering use persisted rule state and joined names', async () => {
      await service.update({ ...admin, ruleId: rule.id, allowCustomerAssignment: 1, allowRescheduleVisit: 1 });
      await service.update({ ...admin, ruleId: rule.id, allowScheduleVisit: 1 });
      const updated = (await service.update({ ...admin, ruleId: rule.id, allowCustomerAssignment: 0, isEnabled: 0 })).rule;
      assert.deepEqual([updated.allowCustomerAssignment, updated.allowScheduleVisit, updated.allowRescheduleVisit], [0, 1, 1]);
      const enabled = await service.list({ ...admin, sourceTeamId: 10, isEnabled: 1 });
      assert.ok(!enabled.rules.some((entry) => String(entry.id) === String(rule.id)));
      await assert.rejects(create(), { code: 'TEAM_ASSIGNMENT_RULE_EXISTS' });
      await service.update({ ...admin, ruleId: rule.id, isEnabled: 1 });
      const list = await service.list({ ...admin, sourceTeamId: 10, isEnabled: 1 });
      const item = list.rules.find((entry) => String(entry.id) === String(rule.id));
      assert.equal(item.sourceTeamName, 'Callers');
      assert.equal(item.targetTeamName, 'Field Officers');
      assert.equal(item.sourceTeam.teamName, 'Callers');
      assert.equal(item.targetTeam.teamName, 'Field Officers');
    });

    await t.test('cross-host teams/rules and missing foreign keys fail without affecting stored rules', async () => {
      await assert.rejects(create({ sourceTeamId: 40 }), { code: 'TEAM_NOT_FOUND' });
      await assert.rejects(create({ targetTeamId: 40 }), { code: 'TEAM_NOT_FOUND' });
      for (const action of ['update', 'remove']) {
        await assert.rejects(service[action]({ ...admin, hostId: 8, ruleId: rule.id, isEnabled: 0 }), { code: 'TEAM_ASSIGNMENT_RULE_NOT_FOUND' });
      }
      await assert.rejects(Rule.create({ hostId: 7, sourceTeamId: 10, targetTeamId: 999, createdAt: 1 }), Sequelize.ForeignKeyConstraintError);
      await assert.rejects(Team.destroy({ where: { id: 10 } }), Sequelize.ForeignKeyConstraintError);
      await assert.rejects(service.update({ ...admin, ruleId: rule.id, targetTeamId: 30, isEnabled: 0 }), { statusCode: 400 });
      assert.equal(await Rule.count(), 5);
    });

    await t.test('soft-deleted rules reactivate the same row and reset unspecified permission flags', async () => {
      await service.remove({ ...admin, ruleId: rule.id });
      const deleted = await Rule.findByPk(rule.id);
      assert.equal(deleted.isDeleted, 1);
      assert.equal(deleted.isEnabled, 0);
      assert.ok(deleted.deletedAt > 0);
      const restored = (await create({ allowCustomerAssignment: 1 })).rule;
      assert.equal(String(restored.id), String(rule.id));
      assert.equal(String(restored.createdAt), String(rule.createdAt));
      assert.equal(restored.isDeleted, 0);
      assert.equal(restored.deletedAt, null);
      assert.deepEqual([restored.allowCustomerAssignment, restored.allowScheduleVisit, restored.allowRescheduleVisit], [1, 0, 0]);
      assert.equal(await Rule.count(), 5);
    });

    const [afterTeams] = await db.query('SELECT * FROM wd_teams ORDER BY id');
    assert.deepEqual(afterTeams, originalTeams);
    const [members] = await db.query('SELECT COUNT(*) AS total FROM wd_team_members');
    assert.equal(Number(members[0].total), 0);
  } finally {
    if (db) await db.close();
    if (applicationDb) await applicationDb.close();
    try {
      await connection.query(`DROP DATABASE IF EXISTS \`${database}\``);
    } finally {
      await connection.close();
    }
  }
});
