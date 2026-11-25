'use strict';

const TABLE = 'wd_user_device_health';
const UNIQUE_INDEX = 'uk_device_health_host_user_device';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = (await queryInterface.showAllTables()).map((table) =>
      typeof table === 'string' ? table : table.tableName);
    if (tables.includes(TABLE)) {
      throw new Error(`${TABLE} already exists; verify its schema before recording this migration`);
    }

    // The device FK is deferred until the deployed composite index and collation are verified.
    // All timestamps are Unix seconds, including the Android observation timestamps.
    await queryInterface.createTable(TABLE, {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: { type: Sequelize.BIGINT, allowNull: false },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      deviceId: { type: Sequelize.STRING(255), allowNull: false },
      schemaVersion: { type: Sequelize.INTEGER, allowNull: false },
      sequence: { type: Sequelize.BIGINT, allowNull: false },
      collectedAt: { type: Sequelize.BIGINT, allowNull: false },
      receivedAt: { type: Sequelize.BIGINT, allowNull: false },
      syncReason: { type: Sequelize.STRING(64), allowNull: true },
      deviceModel: { type: Sequelize.STRING(100), allowNull: true },
      manufacturer: { type: Sequelize.STRING(100), allowNull: true },
      androidVersion: { type: Sequelize.STRING(50), allowNull: true },
      sdkInt: { type: Sequelize.SMALLINT, allowNull: true },
      appVersion: { type: Sequelize.STRING(64), allowNull: true },
      versionCode: { type: Sequelize.BIGINT, allowNull: true },
      locationPermission: { type: Sequelize.STRING(64), allowNull: true },
      backgroundLocationPermission: { type: Sequelize.STRING(64), allowNull: true },
      cameraPermission: { type: Sequelize.STRING(64), allowNull: true },
      microphonePermission: { type: Sequelize.STRING(64), allowNull: true },
      notificationPermission: { type: Sequelize.STRING(64), allowNull: true },
      locationEnabled: { type: Sequelize.BOOLEAN, allowNull: true },
      gpsProviderEnabled: { type: Sequelize.BOOLEAN, allowNull: true },
      batteryOptimizationIgnored: { type: Sequelize.BOOLEAN, allowNull: true },
      batterySaverEnabled: { type: Sequelize.BOOLEAN, allowNull: true },
      backgroundRestricted: { type: Sequelize.BOOLEAN, allowNull: true },
      appNotificationsEnabled: { type: Sequelize.BOOLEAN, allowNull: true },
      trackingNotificationChannelEnabled: { type: Sequelize.BOOLEAN, allowNull: true },
      trackingExpected: { type: Sequelize.BOOLEAN, allowNull: true },
      trackingServiceRunning: { type: Sequelize.BOOLEAN, allowNull: true },
      trackingStatus: { type: Sequelize.STRING(64), allowNull: true },
      trackingIssue: { type: Sequelize.STRING(255), allowNull: true },
      lastLocationFetchResult: { type: Sequelize.STRING(64), allowNull: true },
      lastLocationFailureReason: { type: Sequelize.STRING(255), allowNull: true },
      lastLocationFetchAt: { type: Sequelize.BIGINT, allowNull: true },
      lastSuccessfulLocationAt: { type: Sequelize.BIGINT, allowNull: true },
      lastLocationAccuracyMeters: { type: Sequelize.DOUBLE, allowNull: true },
      connected: { type: Sequelize.BOOLEAN, allowNull: true },
      internetValidated: { type: Sequelize.BOOLEAN, allowNull: true },
      networkType: { type: Sequelize.STRING(64), allowNull: true },
      createdAt: { type: Sequelize.BIGINT, allowNull: false },
      updatedAt: { type: Sequelize.BIGINT, allowNull: true },
      isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: Sequelize.BIGINT, allowNull: true },
    }, {
      uniqueKeys: {
        [UNIQUE_INDEX]: { customIndex: true, fields: ['hostId', 'userId', 'deviceId'] },
      },
    });
  },

  async down(queryInterface) {
    // Data-lossy: all device health snapshots are permanently removed.
    await queryInterface.dropTable(TABLE);
  },
};
