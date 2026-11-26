'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.createTable('wd_customer_visit_plans', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'wd_hosts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      customerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'wd_customers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      customerLocalId: { type: Sequelize.STRING(100), allowNull: true },
      assignedUserId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'wd_users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      scheduledDate: { type: Sequelize.BIGINT, allowNull: false },
      scheduledTime: { type: Sequelize.STRING(5), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      status: {
        type: Sequelize.ENUM('SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'),
        allowNull: false,
        defaultValue: 'SCHEDULED',
      },
      checkInVisitId: {
        type: Sequelize.BIGINT,
        allowNull: true,
        references: { model: 'wd_visits', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      checkInAt: { type: Sequelize.BIGINT, allowNull: true },
      completedAt: { type: Sequelize.BIGINT, allowNull: true },
      cancelledAt: { type: Sequelize.BIGINT, allowNull: true },
      cancellationRemarks: { type: Sequelize.TEXT, allowNull: true },
      idempotencyKey: { type: Sequelize.STRING(100), allowNull: true },
      createdBy: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'wd_users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      createdAt: { type: Sequelize.BIGINT, allowNull: false },
      updatedAt: { type: Sequelize.BIGINT, allowNull: true },
      isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
    });
    await queryInterface.createTable('wd_customer_visit_plan_history', {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'wd_hosts', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      visitId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'wd_customer_visit_plans', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      customerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'wd_customers', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      eventType: {
        type: Sequelize.ENUM(
          'VISIT_SCHEDULED',
          'VISIT_RESCHEDULED',
          'VISIT_CHECKED_IN',
          'VISIT_COMPLETED',
          'VISIT_CANCELLED'
        ),
        allowNull: false,
      },
      oldScheduledDate: { type: Sequelize.BIGINT, allowNull: true },
      newScheduledDate: { type: Sequelize.BIGINT, allowNull: true },
      oldScheduledTime: { type: Sequelize.STRING(5), allowNull: true },
      newScheduledTime: { type: Sequelize.STRING(5), allowNull: true },
      remarks: { type: Sequelize.TEXT, allowNull: true },
      performedBy: {
        type: Sequelize.BIGINT,
        allowNull: false,
        references: { model: 'wd_users', key: 'id' },
        onUpdate: 'CASCADE',
        onDelete: 'RESTRICT',
      },
      eventAt: { type: Sequelize.BIGINT, allowNull: false },
      createdAt: { type: Sequelize.BIGINT, allowNull: false },
      updatedAt: { type: Sequelize.BIGINT, allowNull: true },
      isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
    });
    await queryInterface.addIndex('wd_customer_visit_plans', ['hostId', 'customerId', 'scheduledDate', 'status']);
    await queryInterface.addIndex('wd_customer_visit_plans', ['hostId', 'assignedUserId', 'scheduledDate']);
    await queryInterface.addIndex('wd_customer_visit_plans', ['hostId', 'status']);
    await queryInterface.addIndex('wd_customer_visit_plans', ['hostId', 'idempotencyKey'], { unique: true });
    await queryInterface.addIndex('wd_customer_visit_plan_history', ['hostId', 'visitId', 'eventAt']);
    await queryInterface.addIndex('wd_customer_visit_plan_history', ['hostId', 'customerId', 'eventAt']);
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wd_customer_visit_plan_history');
    await queryInterface.dropTable('wd_customer_visit_plans');
  },
};
