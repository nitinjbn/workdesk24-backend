'use strict';

const TABLE_NAME = 'wd_user_refresh_tokens';
const LEGACY_TABLE_NAME = 'wd_admin_refresh_tokens';
const OWNERSHIP_TABLE = 'wd_migration_object_ownership';
const MIGRATION_NAME = '20261030110000-ensure-user-refresh-token-table';

const getTableNames = async (queryInterface) => {
  const tables = await queryInterface.showAllTables();
  return tables.map((table) => (typeof table === 'string' ? table : table.tableName));
};

module.exports = {
  async up(queryInterface, Sequelize) {
    const tableNames = await getTableNames(queryInterface);
    if (tableNames.includes(TABLE_NAME)) {
      return;
    }

    if (tableNames.includes(LEGACY_TABLE_NAME)) {
      const [rows] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS rowCount FROM ${LEGACY_TABLE_NAME}`
      );
      if (Number(rows[0].rowCount) > 0) {
        throw new Error(
          'Legacy refresh-token rows require a reviewed conversion before creating wd_user_refresh_tokens.'
        );
      }
    }

    if (!tableNames.includes(OWNERSHIP_TABLE)) {
      await queryInterface.createTable(OWNERSHIP_TABLE, {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        migrationName: { type: Sequelize.STRING(128), allowNull: false },
        objectName: { type: Sequelize.STRING(128), allowNull: false },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
      });
      await queryInterface.addIndex(OWNERSHIP_TABLE, ['migrationName', 'objectName'], {
        unique: true,
        name: 'uk_migration_object_ownership',
      });
    }

    await queryInterface.createTable(TABLE_NAME, {
      id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
      hostId: { type: Sequelize.BIGINT, allowNull: false },
      userId: { type: Sequelize.BIGINT, allowNull: false },
      tokenHash: { type: Sequelize.STRING(128), allowNull: false },
      tokenFamily: { type: Sequelize.STRING(64), allowNull: false },
      deviceType: { type: Sequelize.ENUM('WEB', 'ANDROID', 'IOS'), allowNull: false },
      deviceId: { type: Sequelize.STRING(255), allowNull: false },
      deviceName: { type: Sequelize.STRING(255), allowNull: true },
      appVersion: { type: Sequelize.STRING(20), allowNull: true },
      expiresAt: { type: Sequelize.BIGINT, allowNull: false },
      lastUsedAt: { type: Sequelize.BIGINT, allowNull: true },
      createdAt: { type: Sequelize.BIGINT, allowNull: false },
      updatedAt: { type: Sequelize.BIGINT, allowNull: false },
      replacedByTokenHash: { type: Sequelize.STRING(128), allowNull: true },
      isRevoked: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
      revokedReason: { type: Sequelize.STRING(50), allowNull: true },
      revokedAt: { type: Sequelize.BIGINT, allowNull: true },
    });

    await queryInterface.addIndex(TABLE_NAME, ['hostId', 'userId', 'deviceId'], {
      unique: true,
      name: 'uk_host_user_device',
    });
    await queryInterface.addIndex(TABLE_NAME, ['tokenHash'], {
      unique: true,
      name: 'uk_token_hash',
    });
    await queryInterface.addIndex(TABLE_NAME, ['hostId'], { name: 'idx_hostId' });
    await queryInterface.addIndex(TABLE_NAME, ['userId'], { name: 'idx_userId' });
    await queryInterface.addIndex(TABLE_NAME, ['tokenFamily'], { name: 'idx_tokenFamily' });
    await queryInterface.addIndex(TABLE_NAME, ['expiresAt'], { name: 'idx_expiresAt' });
    await queryInterface.addIndex(TABLE_NAME, ['isRevoked'], { name: 'idx_isRevoked' });
    await queryInterface.bulkInsert(OWNERSHIP_TABLE, [{
      migrationName: MIGRATION_NAME,
      objectName: TABLE_NAME,
      createdAt: Math.floor(Date.now() / 1000),
    }]);
  },

  async down(queryInterface) {
    const tableNames = await getTableNames(queryInterface);
    if (!tableNames.includes(TABLE_NAME) || !tableNames.includes(OWNERSHIP_TABLE)) {
      return;
    }

    const [ownershipRows] = await queryInterface.sequelize.query(
      `SELECT id FROM ${OWNERSHIP_TABLE} WHERE migrationName = :migrationName AND objectName = :objectName`,
      { replacements: { migrationName: MIGRATION_NAME, objectName: TABLE_NAME } }
    );
    if (!ownershipRows.length) {
      return;
    }

    const [rows] = await queryInterface.sequelize.query(
      `SELECT COUNT(*) AS rowCount FROM ${TABLE_NAME}`
    );
    if (Number(rows[0].rowCount) > 0) {
      throw new Error('Refusing to drop a populated refresh-token table.');
    }

    await queryInterface.dropTable(TABLE_NAME);
    await queryInterface.bulkDelete(OWNERSHIP_TABLE, {
      migrationName: MIGRATION_NAME,
      objectName: TABLE_NAME,
    });
  },
};