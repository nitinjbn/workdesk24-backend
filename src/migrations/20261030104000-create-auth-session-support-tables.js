'use strict';

const TABLES = {
  userDevices: 'wd_user_devices',
  userSettings: 'wd_user_settings',
  userPermissions: 'wd_user_permissions',
  attendanceSites: 'wd_attendance_sites',
  userAttendanceSites: 'wd_user_attendance_sites',
};

async function getTableNames(queryInterface) {
  const tables = await queryInterface.showAllTables();
  return tables.map((table) => (typeof table === 'string' ? table : table.tableName));
}

module.exports = {
  async up(queryInterface, Sequelize) {
    let existing = await getTableNames(queryInterface);

    if (!existing.includes(TABLES.userDevices)) {
      await queryInterface.createTable(TABLES.userDevices, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        hostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        userId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        deviceId: { type: Sequelize.STRING(255), allowNull: false },
        deviceName: { type: Sequelize.STRING(100), allowNull: true },
        deviceModel: { type: Sequelize.STRING(100), allowNull: true },
        manufacturer: { type: Sequelize.STRING(100), allowNull: true },
        brand: { type: Sequelize.STRING(100), allowNull: true },
        device: { type: Sequelize.STRING(100), allowNull: true },
        product: { type: Sequelize.STRING(100), allowNull: true },
        hardware: { type: Sequelize.STRING(255), allowNull: true },
        osVersion: { type: Sequelize.STRING(50), allowNull: true },
        sdkInt: { type: Sequelize.SMALLINT, allowNull: true },
        appVersion: { type: Sequelize.STRING(20), allowNull: true },
        storageTotalBytes: { type: Sequelize.BIGINT, allowNull: true },
        storageAvailableBytes: { type: Sequelize.BIGINT, allowNull: true },
        storageUsedBytes: { type: Sequelize.BIGINT, allowNull: true },
        isActive: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        sessionId: { type: Sequelize.STRING(100), allowNull: true },
        fcmToken: { type: Sequelize.STRING(255), allowNull: true },
        createdAt: { type: Sequelize.BIGINT, allowNull: true },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
      await queryInterface.addIndex(TABLES.userDevices, ['hostId'], { name: 'idx_user_devices_host' });
      await queryInterface.addIndex(TABLES.userDevices, ['userId'], { name: 'idx_user_devices_user' });
      await queryInterface.addIndex(TABLES.userDevices, ['hostId', 'userId', 'deviceId'], {
        unique: true,
        name: 'uk_user_devices_host_user_device',
      });
      await queryInterface.addIndex(TABLES.userDevices, ['deviceId'], { name: 'idx_user_devices_device' });
    }

    existing = await getTableNames(queryInterface);
    if (!existing.includes(TABLES.userSettings)) {
      await queryInterface.createTable(TABLES.userSettings, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        userId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_users', key: 'id' },
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
      await queryInterface.addIndex(TABLES.userSettings, ['userId'], { name: 'idx_user_settings_user' });
      await queryInterface.addIndex(TABLES.userSettings, ['settingName'], { name: 'idx_user_settings_name' });
      await queryInterface.addIndex(TABLES.userSettings, ['isEnabled'], { name: 'idx_user_settings_enabled' });
      await queryInterface.addIndex(TABLES.userSettings, ['isDeleted'], { name: 'idx_user_settings_deleted' });
    }

    existing = await getTableNames(queryInterface);
    if (!existing.includes(TABLES.userPermissions)) {
      await queryInterface.createTable(TABLES.userPermissions, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        hostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        userId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        permissionId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_permissions', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
      await queryInterface.addIndex(TABLES.userPermissions, ['hostId'], { name: 'idx_user_permissions_host' });
      await queryInterface.addIndex(TABLES.userPermissions, ['userId'], { name: 'idx_user_permissions_user' });
      await queryInterface.addIndex(TABLES.userPermissions, ['permissionId'], { name: 'idx_user_permissions_permission' });
      await queryInterface.addIndex(TABLES.userPermissions, ['hostId', 'userId', 'permissionId'], { name: 'idx_user_permissions_scope' });
      await queryInterface.addIndex(TABLES.userPermissions, ['isEnabled'], { name: 'idx_user_permissions_enabled' });
      await queryInterface.addIndex(TABLES.userPermissions, ['isDeleted'], { name: 'idx_user_permissions_deleted' });
    }

    existing = await getTableNames(queryInterface);
    if (!existing.includes(TABLES.attendanceSites)) {
      await queryInterface.createTable(TABLES.attendanceSites, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        hostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        siteName: { type: Sequelize.STRING(100), allowNull: false },
        latitude: { type: Sequelize.DECIMAL(10, 8), allowNull: false },
        longitude: { type: Sequelize.DECIMAL(11, 8), allowNull: false },
        radiusMeters: { type: Sequelize.INTEGER, allowNull: false },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
      await queryInterface.addIndex(TABLES.attendanceSites, ['hostId'], { name: 'idx_attendance_sites_host' });
    }

    existing = await getTableNames(queryInterface);
    if (!existing.includes(TABLES.userAttendanceSites)) {
      await queryInterface.createTable(TABLES.userAttendanceSites, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        userId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        attendanceSiteId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: TABLES.attendanceSites, key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
      await queryInterface.addIndex(TABLES.userAttendanceSites, ['userId'], { name: 'idx_user_attendance_sites_user' });
      await queryInterface.addIndex(TABLES.userAttendanceSites, ['attendanceSiteId'], { name: 'idx_user_attendance_sites_site' });
    }
  },

  async down() {
    // Forward-only so rollback cannot drop existing device, settings, or attendance data.
  },
};