'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const table = 'wd_team_assignment_rules';
    const tables = (await queryInterface.showAllTables()).map((entry) =>
      typeof entry === 'string' ? entry : entry.tableName);
    // MySQL DDL implicitly commits; allow resuming after a committed schema step.
    if (!tables.includes(table)) {
      const foreignKey = (model) => ({
        type: Sequelize.BIGINT, allowNull: false,
        references: { model, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      });
      await queryInterface.createTable(table, {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
        hostId: foreignKey('wd_hosts'),
        sourceTeamId: foreignKey('wd_teams'),
        targetTeamId: foreignKey('wd_teams'),
        allowCustomerAssignment: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        allowScheduleVisit: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        allowRescheduleVisit: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      }, { engine: 'InnoDB', charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci' });
    }
    for (const [fields, name, unique] of [
      [['hostId', 'sourceTeamId', 'targetTeamId'], 'uq_team_rules_host_source_target', true],
      [['hostId', 'sourceTeamId', 'isDeleted', 'isEnabled'], 'idx_team_rules_host_source_status', false],
      [['hostId', 'targetTeamId', 'isDeleted', 'isEnabled'], 'idx_team_rules_host_target_status', false],
    ]) {
      const indexes = await queryInterface.showIndex(table);
      if (!indexes.some((index) => index.name === name)) {
        await queryInterface.addIndex(table, fields, { name, unique });
      }
    }
  },

  async down() {
    throw new Error('Team assignment rules retain their unique rows for reactivation. Automatic destructive rollback is not supported.');
  },
};
