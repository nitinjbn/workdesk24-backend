'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    await queryInterface.addColumn('wd_attendance', 'attendanceLocation', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });

    await queryInterface.addColumn('wd_attendance', 'dayoverLocation', {
      type: Sequelize.STRING(255),
      allowNull: true,
    });
  },

  async down(queryInterface) {
    await queryInterface.removeColumn('wd_attendance', 'dayoverLocation');
    await queryInterface.removeColumn('wd_attendance', 'attendanceLocation');
  },
};