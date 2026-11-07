'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('wd_user_refresh_token_history')) {
      await queryInterface.createTable('wd_user_refresh_token_history', {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        refreshTokenId: { type: Sequelize.BIGINT, allowNull: false },
        hostId: { type: Sequelize.BIGINT, allowNull: false },
        userId: { type: Sequelize.BIGINT, allowNull: false },
        tokenHash: { type: Sequelize.STRING(128), allowNull: false },
        tokenFamily: { type: Sequelize.STRING(64), allowNull: false },
        deviceType: { type: Sequelize.ENUM('WEB', 'ANDROID', 'IOS'), allowNull: false },
        deviceId: { type: Sequelize.STRING(255), allowNull: false },
        expiresAt: { type: Sequelize.BIGINT, allowNull: false },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: false },
        revokedAt: { type: Sequelize.BIGINT, allowNull: false },
        replacedByTokenHash: { type: Sequelize.STRING(128), allowNull: true },
        revokedReason: { type: Sequelize.STRING(50), allowNull: false },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
        switchSessionId: { type: Sequelize.STRING(36), allowNull: true, defaultValue: null },
        contextVersion: { type: Sequelize.INTEGER, allowNull: true, defaultValue: null },
      });
    }

    const indexes = await queryInterface.showIndex('wd_user_refresh_token_history');
    const existingIndexNames = new Set(indexes.map((index) => index.name));
    if (!existingIndexNames.has('uk_refresh_history_token_hash')) {
      await queryInterface.addIndex('wd_user_refresh_token_history', ['tokenHash'], {
        unique: true,
        name: 'uk_refresh_history_token_hash',
      });
    }
    if (!existingIndexNames.has('idx_refresh_history_token_id')) {
      await queryInterface.addIndex('wd_user_refresh_token_history', ['refreshTokenId'], {
        name: 'idx_refresh_history_token_id',
      });
    }
    if (!existingIndexNames.has('idx_refresh_history_user_family')) {
      await queryInterface.addIndex('wd_user_refresh_token_history', ['userId', 'tokenFamily'], {
        name: 'idx_refresh_history_user_family',
      });
    }
    const refreshedIndexes = await queryInterface.showIndex('wd_user_refresh_token_history');
    if (!refreshedIndexes.some((index) => index.name === 'idx_refresh_history_switch_session')) {
      await queryInterface.addIndex('wd_user_refresh_token_history', ['switchSessionId'], {
        name: 'idx_refresh_history_switch_session',
      });
    }
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    if (!tables.includes('wd_user_refresh_token_history')) {
      return;
    }

    const [rows] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS historyCount FROM wd_user_refresh_token_history'
    );
    if (Number(rows[0].historyCount) > 0) {
      throw new Error('Refresh-token history is not empty; refusing to discard replay evidence.');
    }

    await queryInterface.dropTable('wd_user_refresh_token_history');
  },
};