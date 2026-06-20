'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const permissionTableExists = await queryInterface.describeTable('wd_permissions').then(() => true).catch(() => false);
    if (!permissionTableExists) {
      await queryInterface.createTable('wd_permissions', {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        permissionCode: {
          type: Sequelize.STRING(20),
          allowNull: false,
        },
        permissionName: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        moduleName: {
          type: Sequelize.STRING(50),
          allowNull: false,
        },
        remarks: {
          type: Sequelize.STRING(255),
          allowNull: true,
        },
        isEnabled: {
          type: Sequelize.TINYINT,
          allowNull: false,
          defaultValue: 1,
        },
        isDeleted: {
          type: Sequelize.TINYINT,
          allowNull: false,
          defaultValue: 0,
        },
        createdAt: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        deletedAt: {
          type: Sequelize.BIGINT,
          allowNull: true,
          defaultValue: null,
        },
      });

      await queryInterface.addIndex('wd_permissions', ['permissionCode']);
      await queryInterface.addIndex('wd_permissions', ['permissionName']);
      await queryInterface.addIndex('wd_permissions', ['moduleName']);
      await queryInterface.addIndex('wd_permissions', ['isEnabled']);
      await queryInterface.addIndex('wd_permissions', ['isDeleted']);
    }

    const rolePermissionTableExists = await queryInterface.describeTable('wd_role_permissions').then(() => true).catch(() => false);
    if (!rolePermissionTableExists) {
      await queryInterface.createTable('wd_role_permissions', {
        id: {
          type: Sequelize.BIGINT,
          autoIncrement: true,
          primaryKey: true,
        },
        hostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
        roleId: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
        permissionId: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
        isEnabled: {
          type: Sequelize.TINYINT,
          allowNull: false,
          defaultValue: 1,
        },
        isDeleted: {
          type: Sequelize.TINYINT,
          allowNull: false,
          defaultValue: 0,
        },
        createdAt: {
          type: Sequelize.BIGINT,
          allowNull: false,
        },
        updatedAt: {
          type: Sequelize.BIGINT,
          allowNull: true,
        },
        deletedAt: {
          type: Sequelize.BIGINT,
          allowNull: true,
          defaultValue: null,
        },
      });

      await queryInterface.addIndex('wd_role_permissions', ['hostId']);
      await queryInterface.addIndex('wd_role_permissions', ['roleId']);
      await queryInterface.addIndex('wd_role_permissions', ['permissionId']);
      await queryInterface.addIndex('wd_role_permissions', ['isEnabled']);
      await queryInterface.addIndex('wd_role_permissions', ['isDeleted']);
      await queryInterface.addIndex('wd_role_permissions', ['hostId', 'roleId', 'permissionId']);
    }
  },

  async down(queryInterface) {
    const rolePermissionTableExists = await queryInterface.describeTable('wd_role_permissions').then(() => true).catch(() => false);
    if (rolePermissionTableExists) {
      await queryInterface.dropTable('wd_role_permissions');
    }

    const permissionTableExists = await queryInterface.describeTable('wd_permissions').then(() => true).catch(() => false);
    if (permissionTableExists) {
      await queryInterface.dropTable('wd_permissions');
    }
  },
};
