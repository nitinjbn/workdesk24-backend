'use strict';

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const schema = await queryInterface.describeTable('wd_attendance');
    if (!schema.attendanceLocation) {
      await queryInterface.addColumn('wd_attendance', 'attendanceLocation', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }

    if (!schema.dayoverLocation) {
      await queryInterface.addColumn('wd_attendance', 'dayoverLocation', {
        type: Sequelize.STRING(255),
        allowNull: true,
      });
    }
  },

  async down() {
    // Columns may predate this migration in fresh-install schemas; rollback is forward-only.
  },
};