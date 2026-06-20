'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const tableExists = await queryInterface.describeTable('wd_orders_products').then(() => true).catch(() => false);
    if (tableExists) {
      return;
    }

    await queryInterface.createTable('wd_orders_products', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      orderId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      productId: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      productName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      productCode: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      description: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      unitPrice: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      taxAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      discountAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_orders_products', ['orderId']);
    await queryInterface.addIndex('wd_orders_products', ['userId']);
    await queryInterface.addIndex('wd_orders_products', ['localId']);
    await queryInterface.addIndex('wd_orders_products', ['productId']);
  },

  async down(queryInterface) {
    const tableExists = await queryInterface.describeTable('wd_orders_products').then(() => true).catch(() => false);
    if (!tableExists) {
      return;
    }

    await queryInterface.dropTable('wd_orders_products');
  },
};
