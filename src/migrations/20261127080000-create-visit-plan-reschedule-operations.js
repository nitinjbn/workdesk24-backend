'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wd_visit_plan_reschedule_operations', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: 'wd_hosts', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      userId: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: 'wd_users', key: 'id' }, onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      visitId: {
        type: Sequelize.BIGINT, allowNull: false,
        references: { model: 'wd_customer_visit_plans', key: 'id' },
        onUpdate: 'CASCADE', onDelete: 'RESTRICT',
      },
      keyHash: { type: Sequelize.STRING(64), allowNull: false },
      requestHash: { type: Sequelize.STRING(64), allowNull: false },
      result: { type: Sequelize.TEXT('long'), allowNull: false },
      createdAt: { type: Sequelize.BIGINT, allowNull: false },
    });
    await queryInterface.addIndex(
      'wd_visit_plan_reschedule_operations', ['hostId', 'userId', 'keyHash'],
      { unique: true, name: 'visit_plan_reschedule_owner_key' }
    );
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wd_visit_plan_reschedule_operations');
  },
};
