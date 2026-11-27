'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wd_customer_visit_plans', 'idempotencyRequestHash', {
      type: Sequelize.STRING(64),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('wd_customer_visit_plans', 'idempotencyRequestHash');
  },
};
