'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wd_customer_visit_plans', 'rescheduleRevision', {
      type: Sequelize.BIGINT,
      allowNull: false,
      defaultValue: 0,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('wd_customer_visit_plans', 'rescheduleRevision');
  },
};
