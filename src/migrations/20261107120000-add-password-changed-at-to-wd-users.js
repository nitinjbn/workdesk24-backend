'use strict';

const TABLE_NAME = 'wd_users';
const COLUMN_NAME = 'passwordChangedAt';

module.exports = {
  async up(queryInterface, Sequelize) {
    const schema = await queryInterface.describeTable(TABLE_NAME);
    if (!schema[COLUMN_NAME]) {
      await queryInterface.addColumn(TABLE_NAME, COLUMN_NAME, {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      });
    }
  },

  async down(queryInterface) {
    const schema = await queryInterface.describeTable(TABLE_NAME);
    if (schema[COLUMN_NAME]) {
      await queryInterface.removeColumn(TABLE_NAME, COLUMN_NAME);
    }
  },
};
