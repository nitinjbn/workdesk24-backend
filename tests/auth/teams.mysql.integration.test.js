const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const Sequelize = require('sequelize');

test('isolated MySQL verifies team migration, persistence, uniqueness, ownership and concurrent membership', {
  skip: !process.env.TEAM_TEST_MYSQL_SOCKET ? 'Requires TEAM_TEST_MYSQL_SOCKET for an isolated MySQL instance' : false,
}, async (t) => {
  const database = `wd_team_test_${randomUUID().replaceAll('-', '')}`;
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
      hostId: { type: Sequelize.BIGINT, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      employeeCode: { type: Sequelize.STRING(20) },
      accountStatus: { type: Sequelize.STRING(20), defaultValue: 'ACTIVE' },
      isDeleted: { type: Sequelize.TINYINT, defaultValue: 0 },
    });
    await db.query('INSERT INTO wd_hosts (id) VALUES (7), (8)');
    await db.query("INSERT INTO wd_users (id, hostId, name) VALUES (22, 7, 'Local'), (23, 8, 'Foreign')");
    const migration = require('../../src/migrations/20261128090000-create-team-tables');
    await migration.up(qi, Sequelize);
    await migration.up(qi, Sequelize);

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3306';
    process.env.DB_NAME_TEST = database;
    const models = require('../../src/models');
    applicationDb = models.sequelize;
    t.mock.method(applicationDb, 'query', async () => { throw new Error('Unexpected shared database query'); });
    const { initTeam } = require('../../src/models/schemas/Team');
    const { initTeamMember } = require('../../src/models/schemas/TeamMember');
    const Team = initTeam(db);
    const TeamMember = initTeamMember(db);
    models.User.init({
      id: { type: Sequelize.BIGINT, primaryKey: true },
      hostId: { type: Sequelize.BIGINT },
      name: { type: Sequelize.STRING(100) },
      employeeCode: { type: Sequelize.STRING(20) },
      accountStatus: { type: Sequelize.STRING(20) },
      isDeleted: { type: Sequelize.TINYINT },
    }, { sequelize: db, tableName: 'wd_users', timestamps: false });
    Team.associate({ Host: models.Host, TeamMember });
    TeamMember.associate({ Host: models.Host, Team, User: models.User });
    const { TeamRepository } = require('../../src/modules/auth/repositories/team.repository');
    const { TeamService } = require('../../src/modules/auth/services/team.service');
    const service = new TeamService(new TeamRepository(), () => db.transaction());
    const scope = { hostId: 7, isAdmin: true };
    const create = (teamName, hostId = 7) => service.create({ ...scope, hostId, teamName });
    const add = (teamId, userId = 22, hostId = 7) => service.addMember({ ...scope, hostId, teamId, userId });
    const teamId = (await create(' Telecallers ')).team.id;

    await t.test('case-insensitive host-name constraint and active-name deletion semantics', async () => {
      await assert.rejects(create('telecallers'), { code: 'TEAM_NAME_EXISTS', statusCode: 409 });
      await create('Telecallers', 8);
      await service.update({ ...scope, teamId, isEnabled: 0 });
      await assert.rejects(create('TELECALLERS'), { code: 'TEAM_NAME_EXISTS' });
      const teams = await service.list({ ...scope, search: 'call', limit: 1 });
      assert.equal(teams.teams.length, 1);
      assert.equal(teams.pagination.total, 1);
    });

    await t.test('membership concurrency, multi-team membership and same-row reactivation', async () => {
      const outcomes = await Promise.allSettled([add(teamId), add(teamId), add(teamId)]);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      const failures = outcomes.filter((outcome) => outcome.status === 'rejected');
      assert.ok(failures.every((outcome) => outcome.reason.code === 'TEAM_MEMBER_EXISTS'));
      const second = (await create('Field Officers')).team.id;
      await add(second);
      assert.equal(await TeamMember.count(), 2);
      const before = await TeamMember.findOne({ where: { hostId: 7, teamId, userId: 22 } });
      await service.removeMember({ ...scope, teamId, userId: 22 });
      const restored = (await add(teamId)).member;
      assert.equal(String(restored.id), String(before.id));
      assert.equal(String(restored.createdAt), String(before.createdAt));
      assert.equal(restored.isEnabled, 1);
      await service.updateMember({ ...scope, teamId, userId: 22, isEnabled: 0 });
      await service.updateMember({ ...scope, teamId, userId: 22, isEnabled: 1 });
      const detail = await service.detail({ ...scope, teamId });
      assert.equal(detail.members.length, 1);
      assert.equal(detail.members[0].user.name, 'Local');
      await assert.rejects(TeamMember.create({
        hostId: 7, teamId, userId: 22, createdAt: 1,
      }), Sequelize.UniqueConstraintError);
    });

    await t.test('cross-host access fails and foreign-key constraints reject missing references', async () => {
      await assert.rejects(add(teamId, 23), { code: 'TEAM_USER_NOT_FOUND' });
      await assert.rejects(add(teamId, 23, 8), { code: 'TEAM_NOT_FOUND' });
      await assert.rejects(service.detail({ ...scope, hostId: 8, teamId }), { code: 'TEAM_NOT_FOUND' });
      await assert.rejects(service.remove({ ...scope, hostId: 8, teamId }), { code: 'TEAM_NOT_FOUND' });
      await assert.rejects(TeamMember.create({
        hostId: 7, teamId, userId: 999, createdAt: 1,
      }), Sequelize.ForeignKeyConstraintError);
      await assert.rejects(Team.destroy({ where: { id: teamId } }), Sequelize.ForeignKeyConstraintError);
    });

    await t.test('array membership mutations deduplicate, reactivate and roll back as one transaction', async () => {
      await db.query("INSERT INTO wd_users (id,hostId,name) VALUES (24,7,'Local Two'),(26,7,'No membership')");
      const batchTeamId = (await create('Batch Team')).team.id;
      const initial = (await add(batchTeamId, 22)).member;
      await service.removeMember({ ...scope, teamId: batchTeamId, userId: 22 });
      const added = await add(batchTeamId, [24, 22, 24]);
      assert.deepEqual(added.members.map((member) => Number(member.userId)), [22, 24]);
      assert.equal(String(added.members[0].id), String(initial.id));
      assert.equal(String(added.members[0].createdAt), String(initial.createdAt));
      assert.equal(await TeamMember.count({ where: { teamId: batchTeamId } }), 2);
      await service.removeMember({ ...scope, teamId: batchTeamId, userId: 22 });
      for (const [userId, code] of [[[22, 23], 'TEAM_USER_NOT_FOUND'], [[22, 24], 'TEAM_MEMBER_EXISTS']]) {
        await assert.rejects(add(batchTeamId, userId), { code });
        assert.equal((await TeamMember.findOne({ where: { teamId: batchTeamId, userId: 22 } })).isEnabled, 0);
      }
      await service.updateMember({ ...scope, teamId: batchTeamId, userId: 22, isEnabled: 1 });
      for (const action of ['updateMember', 'removeMember']) {
        await assert.rejects(service[action]({ ...scope, teamId: batchTeamId, userId: [22, 26], isEnabled: 0 }), { code: 'TEAM_MEMBER_NOT_FOUND' });
        assert.equal((await TeamMember.findOne({ where: { teamId: batchTeamId, userId: 22 } })).isEnabled, 1);
      }
      for (const isEnabled of [0, 1]) {
        const result = await service.updateMember({ ...scope, teamId: batchTeamId, userId: [22, 24], isEnabled });
        assert.ok(result.members.every((member) => member.isEnabled === isEnabled));
      }
      await service.removeMember({ ...scope, teamId: batchTeamId, userId: [24, 22] });
      const outcomes = await Promise.allSettled([add(batchTeamId, [24, 22]), add(batchTeamId, [22, 24, 22])]);
      assert.equal(outcomes.filter((outcome) => outcome.status === 'fulfilled').length, 1);
      assert.equal(outcomes.find((outcome) => outcome.status === 'rejected').reason.code, 'TEAM_MEMBER_EXISTS');
      assert.equal(await TeamMember.count({ where: { teamId: batchTeamId } }), 2);
    });

    await t.test('team deletion retains membership rows, releases its name, and hides old team', async () => {
      const before = await TeamMember.count();
      await service.remove({ ...scope, teamId });
      assert.equal(await TeamMember.count(), before);
      await assert.rejects(service.listMembers({ ...scope, teamId }), { code: 'TEAM_NOT_FOUND' });
      const replacement = (await create('Telecallers')).team;
      assert.notEqual(String(replacement.id), String(teamId));
      assert.deepEqual((await service.detail({ ...scope, teamId: replacement.id })).members, []);
    });
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
