'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((table) =>
      typeof table === 'string' ? table : table.tableName);
    const foreignKey = (model) => ({
      type: Sequelize.BIGINT, allowNull: false,
      references: { model, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE',
    });
    const options = { engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' };

    // MySQL DDL implicitly commits; each schema step must be restartable.
    if (!tables.includes('wd_teams')) {
      await queryInterface.createTable('wd_teams', {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
        hostId: foreignKey('wd_hosts'),
        teamName: { type: Sequelize.STRING(100), allowNull: false },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      }, options);
    }
    const schema = await queryInterface.describeTable('wd_teams');
    if (!schema.activeTeamName) {
      await queryInterface.sequelize.query(
        `ALTER TABLE wd_teams ADD COLUMN activeTeamName VARCHAR(100)
         GENERATED ALWAYS AS (CASE WHEN isDeleted = 0 THEN teamName ELSE NULL END) STORED`
      );
    }
    const addIndex = async (table, fields, name, unique = false) => {
      const indexes = await queryInterface.showIndex(table);
      if (!indexes.some((index) => index.name === name)) {
        await queryInterface.addIndex(table, fields, { name, unique });
      }
    };
    await addIndex('wd_teams', ['hostId', 'activeTeamName'], 'uq_teams_host_active_name', true);
    await addIndex('wd_teams', ['hostId', 'isDeleted', 'isEnabled'], 'idx_teams_host_status');

    if (!tables.includes('wd_team_members')) {
      await queryInterface.createTable('wd_team_members', {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
        hostId: foreignKey('wd_hosts'),
        teamId: foreignKey('wd_teams'),
        userId: foreignKey('wd_users'),
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
      }, options);
    }
    await addIndex('wd_team_members', ['hostId', 'teamId', 'userId'], 'uq_team_members_host_team_user', true);
    await addIndex('wd_team_members', ['hostId', 'teamId', 'isEnabled'], 'idx_team_members_host_team_status');
    await addIndex('wd_team_members', ['hostId', 'userId', 'isEnabled'], 'idx_team_members_host_user_status');
  },

  async down() {
    throw new Error('Team memberships are retained when teams are deleted. Automatic destructive rollback is not supported.');
  },
};
