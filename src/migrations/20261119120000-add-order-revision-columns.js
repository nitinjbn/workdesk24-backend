'use strict';

const table = 'wd_orders';

module.exports = {
  async up(queryInterface, Sequelize) {
    const schema = await queryInterface.describeTable(table);
    if (!schema.isRevised) {
      await queryInterface.addColumn(table, 'isRevised', {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      });
    }
    if (!schema.revisedOrderId) {
      await queryInterface.addColumn(table, 'revisedOrderId', {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
        references: { model: table, key: 'id' },
        onDelete: 'RESTRICT',
      });
    }
  },

  async down(queryInterface) {
    const schema = await queryInterface.describeTable(table);
    if (schema.revisedOrderId) await queryInterface.removeColumn(table, 'revisedOrderId');
    if (schema.isRevised) await queryInterface.removeColumn(table, 'isRevised');
  },
};
