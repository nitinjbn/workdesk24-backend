'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.describeTable('wd_admin_refresh_tokens').then(() => true).catch(() => false);
    if (tableExists) {
      return;
    }

    await queryInterface.createTable('wd_admin_refresh_tokens', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      tokenHash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
      },
      tokenFamily: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      expiresAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      revokedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
      replacedByTokenHash: {
        type: Sequelize.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      isRevoked: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
    });

    await queryInterface.addIndex('wd_admin_refresh_tokens', ['userId']);
    await queryInterface.addIndex('wd_admin_refresh_tokens', ['tokenHash'], { unique: true });
    await queryInterface.addIndex('wd_admin_refresh_tokens', ['tokenFamily']);
    await queryInterface.addIndex('wd_admin_refresh_tokens', ['expiresAt']);
    await queryInterface.addIndex('wd_admin_refresh_tokens', ['isRevoked']);
  },

  async down(queryInterface) {
    const tableExists = await queryInterface.describeTable('wd_admin_refresh_tokens').then(() => true).catch(() => false);
    if (!tableExists) {
      return;
    }

    await queryInterface.dropTable('wd_admin_refresh_tokens');
  },
};