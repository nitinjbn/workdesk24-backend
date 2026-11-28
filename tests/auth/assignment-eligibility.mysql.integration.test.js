const test = require('node:test');
const assert = require('node:assert/strict');
const { randomUUID } = require('node:crypto');
const Sequelize = require('sequelize');

test('private MySQL executes team eligibility filtering, counting and pagination against existing schemas', {
  skip: !process.env.TEAM_TEST_MYSQL_SOCKET ? 'Requires TEAM_TEST_MYSQL_SOCKET for an isolated MySQL instance' : false,
}, async (t) => {
  const database = `wd_eligible_test_${randomUUID().replaceAll('-', '')}`;
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
    const userColumns = {
      id: { type: Sequelize.BIGINT, primaryKey: true },
      hostId: { type: Sequelize.BIGINT, allowNull: false },
      name: { type: Sequelize.STRING(100), allowNull: false },
      accountStatus: { type: Sequelize.STRING(20), defaultValue: 'ACTIVE' },
      isDeleted: { type: Sequelize.TINYINT, defaultValue: 0 },
      isFieldAppUser: { type: Sequelize.TINYINT, defaultValue: 1 },
    };
    await qi.createTable('wd_users', userColumns);
    await db.query('INSERT INTO wd_hosts (id) VALUES (7), (8)');
    await require('../../src/migrations/20261128090000-create-team-tables').up(qi, Sequelize);
    await require('../../src/migrations/20261128100000-create-team-assignment-rules').up(qi, Sequelize);
    await db.query(`INSERT INTO wd_users (id,hostId,name) VALUES
      (1,7,'Actor'),(2,7,'Alice'),(3,7,'Bob'),(4,7,'Aaron'),
      (5,7,'Inactive'),(6,7,'Deleted'),(7,8,'Foreign'),(8,7,'No teams')`);
    await db.query('UPDATE wd_users SET isFieldAppUser = 0 WHERE id = 3');
    await db.query("UPDATE wd_users SET accountStatus = 'INACTIVE' WHERE id = 5");
    await db.query('UPDATE wd_users SET isDeleted = 1 WHERE id = 6');
    await db.query(`INSERT INTO wd_teams (id,hostId,teamName,createdAt) VALUES
      (10,7,'Callers',1),(20,7,'Field',1),(30,7,'Office',1),(40,7,'Support',1),(50,8,'Foreign',1)`);
    await db.query(`INSERT INTO wd_team_members (hostId,teamId,userId,createdAt) VALUES
      (7,10,1,1),(7,20,2,1),(7,30,3,1),(7,20,4,1),(7,20,5,1),(7,20,6,1),(8,50,7,1)`);
    await db.query(`INSERT INTO wd_team_assignment_rules
      (hostId,sourceTeamId,targetTeamId,allowCustomerAssignment,allowScheduleVisit,allowRescheduleVisit,createdAt)
      VALUES (7,10,20,1,1,1,1)`);

    process.env.NODE_ENV = 'test';
    process.env.DB_HOST = '127.0.0.1';
    process.env.DB_PORT = '3306';
    process.env.DB_NAME_TEST = database;
    const models = require('../../src/models');
    applicationDb = models.sequelize;
    t.mock.method(applicationDb, 'query', async () => { throw new Error('Unexpected shared database query'); });
    models.User.init(userColumns, { sequelize: db, tableName: 'wd_users', timestamps: false });
    const { AssignmentEligibilityService } = require('../../src/modules/auth/services/assignment-eligibility.service');
    const service = new AssignmentEligibilityService();
    const list = (fields = {}) => service.getEligibleUsers({ hostId: 7, actorId: 1, action: 'CUSTOMER_ASSIGNMENT', page: 1, limit: 10, ...fields });
    const ids = (result) => result.users.map((user) => Number(user.userId));

    await t.test('targeted permission checks use the caller transaction and the same host/action/self SQL filters', async () => {
      await db.transaction(async (transaction) => {
        const payload = { hostId: 7, actorId: 1, action: 'SCHEDULE_VISIT', transaction };
        assert.equal(await service.isUserEligible({ ...payload, targetUserId: 2 }), true);
        for (const targetUserId of [3, 5, 6, 7, 8, 999]) {
          assert.equal(await service.isUserEligible({ ...payload, targetUserId }), false);
        }
        await db.query('UPDATE wd_team_assignment_rules SET allowScheduleVisit = 0', { transaction });
        assert.equal(await service.isUserEligible({ ...payload, targetUserId: 2 }), false);
        assert.equal(await service.isUserEligible({ ...payload, action: 'RESCHEDULE_VISIT', targetUserId: 2 }), true);
        assert.equal(await service.isUserEligible({ ...payload, action: 'CUSTOMER_ASSIGNMENT', targetUserId: 2 }), true);
        assert.equal(await service.isUserEligible({ ...payload, actorId: 8, targetUserId: 8 }), true);
        await db.query('UPDATE wd_team_assignment_rules SET allowScheduleVisit = 1', { transaction });
      });
    });

    await t.test('multiple sources use OR; matching multiple teams does not duplicate users or counts', async () => {
      assert.deepEqual(ids(await list()), [4, 1, 2]);
      await db.query(`INSERT INTO wd_team_members (hostId,teamId,userId,createdAt)
        VALUES (7,30,1,1),(7,40,3,1),(7,40,2,1),(7,30,2,1)`);
      await db.query(`INSERT INTO wd_team_assignment_rules
        (hostId,sourceTeamId,targetTeamId,allowCustomerAssignment,createdAt) VALUES (7,30,40,1,1)`);
      const result = await list({ limit: 1, page: 2 });
      assert.deepEqual(ids(result), [1]);
      assert.deepEqual(result.pagination, { total: 4, page: 2, limit: 1, totalPages: 4 });
      assert.deepEqual(ids(await list({ search: ' ali ' })), [1, 2]);
      assert.deepEqual(ids(await list({ limit: 1, page: 3 })), [2]);
      assert.deepEqual(ids(await list({ limit: 1, page: 4 })), [3]);
      await db.query('DELETE FROM wd_team_assignment_rules WHERE sourceTeamId = 30');
      await db.query('DELETE FROM wd_team_members WHERE hostId = 7 AND teamId IN (30,40) AND userId IN (1,2,3)');
      await db.query('INSERT INTO wd_team_members (hostId,teamId,userId,createdAt) VALUES (7,30,3,1)');
    });

    await t.test('self is deduplicated when a same-team rule matches and rules never propagate transitively', async () => {
      await db.query(`INSERT INTO wd_team_assignment_rules
        (hostId,sourceTeamId,targetTeamId,allowScheduleVisit,createdAt) VALUES (7,10,10,1,1)`);
      assert.equal(ids(await list({ action: 'SCHEDULE_VISIT' })).filter((id) => id === 1).length, 1);
      assert.ok(ids(await list()).includes(1));
      await db.query('DELETE FROM wd_team_assignment_rules WHERE sourceTeamId = targetTeamId');
      await db.query(`INSERT INTO wd_team_assignment_rules
        (hostId,sourceTeamId,targetTeamId,allowCustomerAssignment,createdAt) VALUES (7,20,30,1,1)`);
      assert.deepEqual(ids(await list()), [4, 1, 2]);
      await db.query('DELETE FROM wd_team_assignment_rules WHERE sourceTeamId = 20');
    });

    await t.test('disabled/deleted rules, source/target memberships and source/target teams are excluded', async () => {
      for (const [disable, restore] of [
        ['UPDATE wd_team_assignment_rules SET isEnabled = 0', 'UPDATE wd_team_assignment_rules SET isEnabled = 1'],
        ['UPDATE wd_team_assignment_rules SET isDeleted = 1', 'UPDATE wd_team_assignment_rules SET isDeleted = 0'],
        ['UPDATE wd_team_members SET isEnabled = 0 WHERE userId = 1', 'UPDATE wd_team_members SET isEnabled = 1 WHERE userId = 1'],
        ['UPDATE wd_team_members SET isEnabled = 0 WHERE teamId = 20', 'UPDATE wd_team_members SET isEnabled = 1 WHERE teamId = 20'],
        ...[10, 20].flatMap((teamId) => [
          [`UPDATE wd_teams SET isEnabled = 0 WHERE id = ${teamId}`, `UPDATE wd_teams SET isEnabled = 1 WHERE id = ${teamId}`],
          [`UPDATE wd_teams SET isDeleted = 1 WHERE id = ${teamId}`, `UPDATE wd_teams SET isDeleted = 0 WHERE id = ${teamId}`],
        ]),
      ]) {
        await db.query(disable);
        assert.deepEqual(ids(await list()), [1], disable);
        await db.query(restore);
      }
    });

    await t.test('active-user and field-app filters are applied independently for the three actions', async () => {
      assert.deepEqual(ids(await list()), [4, 1, 2], 'Inactive/deleted target users are absent');
      await db.query(`INSERT INTO wd_team_assignment_rules
        (hostId,sourceTeamId,targetTeamId,allowCustomerAssignment,allowScheduleVisit,allowRescheduleVisit,createdAt)
        VALUES (7,10,30,1,1,1,1)`);
      assert.deepEqual(ids(await list()), [4, 1, 2, 3]);
      for (const action of ['SCHEDULE_VISIT', 'RESCHEDULE_VISIT']) {
        assert.deepEqual(ids(await list({ action })), [4, 1, 2]);
      }
      await db.query('UPDATE wd_team_assignment_rules SET allowScheduleVisit = 0');
      assert.deepEqual(ids(await list({ action: 'SCHEDULE_VISIT' })), [1]);
      assert.deepEqual(ids(await list({ action: 'RESCHEDULE_VISIT' })), [4, 1, 2]);
      await db.query('DELETE FROM wd_team_assignment_rules WHERE targetTeamId = 30');
      await db.query('UPDATE wd_team_assignment_rules SET allowScheduleVisit = 1');
    });

    await t.test('cross-host corruption in any ownership join cannot grant eligibility', async () => {
      for (const [poison, restore] of [
        ['UPDATE wd_team_members SET hostId = 8 WHERE userId = 1', 'UPDATE wd_team_members SET hostId = 7 WHERE userId = 1'],
        ['UPDATE wd_team_members SET teamId = 50 WHERE userId = 1', 'UPDATE wd_team_members SET teamId = 10 WHERE userId = 1'],
        ['UPDATE wd_team_assignment_rules SET hostId = 8', 'UPDATE wd_team_assignment_rules SET hostId = 7'],
        ['UPDATE wd_team_assignment_rules SET targetTeamId = 50', 'UPDATE wd_team_assignment_rules SET targetTeamId = 20'],
        ['UPDATE wd_team_members SET hostId = 8 WHERE teamId = 20', 'UPDATE wd_team_members SET hostId = 7 WHERE teamId = 20'],
        ['UPDATE wd_users SET hostId = 8 WHERE id IN (2,4)', 'UPDATE wd_users SET hostId = 7 WHERE id IN (2,4)'],
      ]) {
        await db.query(poison);
        assert.deepEqual(ids(await list()), [1], poison);
        await db.query(restore);
      }
    });

    await t.test('all actions include self without membership, matching search or field-app access; pagination is optional', async () => {
      await db.query('UPDATE wd_users SET isFieldAppUser = 0 WHERE id = 8');
      const visitRepository = require('../../src/modules/staff/repositories/visit-plan.repository').default;
      assert.equal(Number((await visitRepository.findUser(7, 8, undefined, false)).id), 8);
      assert.equal(await visitRepository.findUser(7, 8), null);
      for (const action of ['CUSTOMER_ASSIGNMENT', 'SCHEDULE_VISIT', 'RESCHEDULE_VISIT']) {
        const result = await service.getEligibleUsers({ hostId: 7, actorId: 8, action, search: 'unmatched' });
        assert.deepEqual(result.users, [{ userId: 8, name: 'No teams' }]);
        assert.equal(Object.hasOwn(result, 'pagination'), false);
      }
    });

    await t.test('missing memberships, zero permissions and missing rules return self only', async () => {
      assert.deepEqual(ids(await list({ actorId: 8 })), [8]);
      await db.query('UPDATE wd_team_assignment_rules SET allowCustomerAssignment = 0');
      assert.deepEqual(ids(await list()), [1]);
      await db.query('DELETE FROM wd_team_assignment_rules');
      assert.deepEqual(await list(), { users: [{ userId: 1, name: 'Actor' }], pagination: { total: 1, page: 1, limit: 10, totalPages: 1 } });
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
