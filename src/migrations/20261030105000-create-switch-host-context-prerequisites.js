'use strict';

const TABLES = {
  settings: 'wd_host_settings',
  cycles: 'wd_subscription_cycles',
  subscriptions: 'wd_host_subscriptions',
};

module.exports = {
  async up(queryInterface, Sequelize) {
    let existing = await queryInterface.showAllTables();
    existing = existing.map((table) => (typeof table === 'string' ? table : table.tableName));

    if (!existing.includes(TABLES.settings)) {
      await queryInterface.createTable(TABLES.settings, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        hostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        settingName: { type: Sequelize.STRING(255), allowNull: false },
        settingValue: { type: Sequelize.TEXT, allowNull: true },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
      await queryInterface.addIndex(TABLES.settings, ['hostId'], { name: 'idx_host_settings_host' });
      await queryInterface.addIndex(TABLES.settings, ['settingName'], { name: 'idx_host_settings_name' });
      await queryInterface.addIndex(TABLES.settings, ['isEnabled'], { name: 'idx_host_settings_enabled' });
      await queryInterface.addIndex(TABLES.settings, ['isDeleted'], { name: 'idx_host_settings_deleted' });
    }

    existing = await queryInterface.showAllTables();
    existing = existing.map((table) => (typeof table === 'string' ? table : table.tableName));
    if (!existing.includes(TABLES.cycles)) {
      await queryInterface.createTable(TABLES.cycles, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        cycleCode: { type: Sequelize.STRING(20), allowNull: false },
        cycleName: { type: Sequelize.STRING(50), allowNull: false },
        validityInMonths: { type: Sequelize.SMALLINT, allowNull: false },
        perUserMonthlyPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        perUserSetupPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        minimumUsers: { type: Sequelize.SMALLINT, allowNull: false },
        isPopular: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        remarks: { type: Sequelize.STRING(255), allowNull: true },
        sortOrder: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
      await queryInterface.addIndex(TABLES.cycles, ['cycleCode'], { name: 'idx_subscription_cycles_code' });
      await queryInterface.addIndex(TABLES.cycles, ['cycleName'], { name: 'idx_subscription_cycles_name' });
      await queryInterface.addIndex(TABLES.cycles, ['validityInMonths'], { name: 'idx_subscription_cycles_validity' });
      await queryInterface.addIndex(TABLES.cycles, ['perUserMonthlyPrice'], { name: 'idx_subscription_cycles_monthly_price' });
      await queryInterface.addIndex(TABLES.cycles, ['perUserSetupPrice'], { name: 'idx_subscription_cycles_setup_price' });
      await queryInterface.addIndex(TABLES.cycles, ['minimumUsers'], { name: 'idx_subscription_cycles_minimum_users' });
      await queryInterface.addIndex(TABLES.cycles, ['isPopular'], { name: 'idx_subscription_cycles_popular' });
      await queryInterface.addIndex(TABLES.cycles, ['isEnabled'], { name: 'idx_subscription_cycles_enabled' });
      await queryInterface.addIndex(TABLES.cycles, ['isDeleted'], { name: 'idx_subscription_cycles_deleted' });
    }

    existing = await queryInterface.showAllTables();
    existing = existing.map((table) => (typeof table === 'string' ? table : table.tableName));
    if (!existing.includes(TABLES.subscriptions)) {
      await queryInterface.createTable(TABLES.subscriptions, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        hostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        subscriptionCycleId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: TABLES.cycles, key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        licensedUserCount: { type: Sequelize.INTEGER, allowNull: false },
        validityInMonths: { type: Sequelize.SMALLINT, allowNull: false },
        perUserMonthlyPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        perUserSetupPrice: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        discountType: { type: Sequelize.ENUM('PERCENTAGE', 'FIXED'), allowNull: true },
        discountValue: { type: Sequelize.DECIMAL(10, 2), allowNull: true },
        grossAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        discountAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        netAmount: { type: Sequelize.DECIMAL(10, 2), allowNull: false },
        planStartDate: { type: Sequelize.DATEONLY, allowNull: false },
        planEndDate: { type: Sequelize.DATEONLY, allowNull: false },
        paymentStatus: { type: Sequelize.ENUM('FREE', 'PENDING', 'PAID'), allowNull: false },
        paymentReference: { type: Sequelize.STRING(255), allowNull: true },
        remarks: { type: Sequelize.STRING(255), allowNull: true },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
      await queryInterface.addIndex(TABLES.subscriptions, ['hostId'], { name: 'idx_host_subscriptions_host' });
      await queryInterface.addIndex(TABLES.subscriptions, ['subscriptionCycleId'], { name: 'idx_host_subscriptions_cycle' });
      await queryInterface.addIndex(TABLES.subscriptions, ['licensedUserCount'], { name: 'idx_host_subscriptions_licensed_users' });
      await queryInterface.addIndex(TABLES.subscriptions, ['discountType'], { name: 'idx_host_subscriptions_discount_type' });
      await queryInterface.addIndex(TABLES.subscriptions, ['discountValue'], { name: 'idx_host_subscriptions_discount_value' });
      await queryInterface.addIndex(TABLES.subscriptions, ['isEnabled'], { name: 'idx_host_subscriptions_enabled' });
      await queryInterface.addIndex(TABLES.subscriptions, ['isDeleted'], { name: 'idx_host_subscriptions_deleted' });
    }
  },

  async down() {
    // These prerequisite tables are intentionally forward-only to avoid dropping existing host data.
  },
};