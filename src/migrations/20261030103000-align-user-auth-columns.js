'use strict';

const TABLE_NAME = 'wd_users';

module.exports = {
  async up(queryInterface, Sequelize) {
    const schema = await queryInterface.describeTable(TABLE_NAME);
    const columns = [
      ['designationId', { type: Sequelize.BIGINT, allowNull: true }],
      ['employeeCode', { type: Sequelize.STRING(20), allowNull: true }],
      ['enteredMobileNumber', { type: Sequelize.STRING(20), allowNull: true }],
      ['callingCode', { type: Sequelize.STRING(6), allowNull: true }],
      ['mobileVerified', { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 }],
      ['mobileVerifiedAt', { type: Sequelize.BIGINT, allowNull: true, defaultValue: null }],
      ['dateOfBirth', { type: Sequelize.BIGINT, allowNull: true }],
      ['gender', { type: Sequelize.ENUM('MALE', 'FEMALE', 'OTHER', 'PREFER_NOT_TO_SAY'), allowNull: true }],
      ['accountStatus', { type: Sequelize.ENUM('ACTIVE', 'INACTIVE'), allowNull: false, defaultValue: 'ACTIVE' }],
      ['accountStatusUpdatedAt', { type: Sequelize.BIGINT, allowNull: true, defaultValue: null }],
      ['addressLine1', { type: Sequelize.STRING(50), allowNull: true }],
      ['addressLine2', { type: Sequelize.STRING(50), allowNull: true }],
      ['landmark', { type: Sequelize.STRING(50), allowNull: true }],
      ['countryName', { type: Sequelize.STRING(50), allowNull: true }],
      ['countryIsoCode', { type: Sequelize.CHAR(2), allowNull: true }],
      ['stateName', { type: Sequelize.STRING(50), allowNull: true }],
      ['stateIsoCode', { type: Sequelize.CHAR(2), allowNull: true }],
      ['city', { type: Sequelize.STRING(50), allowNull: true }],
      ['district', { type: Sequelize.STRING(50), allowNull: true }],
      ['pinCode', { type: Sequelize.STRING(20), allowNull: true }],
      ['timezone', { type: Sequelize.STRING(50), allowNull: true }],
      ['holidayCalendarId', { type: Sequelize.BIGINT, allowNull: true }],
      ['leavePolicyId', { type: Sequelize.BIGINT, allowNull: true }],
      ['isFieldAppUser', { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 }],
      ['isAdminUser', { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 }],
      ['isSuperAdmin', { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 }],
    ];
    const adminFlagWasMissing = !schema.isAdminUser;
    const accountStatusWasMissing = !schema.accountStatus;
    const accountStatusTimestampWasMissing = !schema.accountStatusUpdatedAt;

    for (const [columnName, definition] of columns) {
      if (!schema[columnName]) {
        await queryInterface.addColumn(TABLE_NAME, columnName, definition);
      }
    }

    if (accountStatusWasMissing && schema.isActive) {
      await queryInterface.sequelize.query(
        "UPDATE wd_users SET accountStatus = 'INACTIVE' WHERE isActive = 0"
      );
    }
    if (accountStatusTimestampWasMissing) {
      await queryInterface.sequelize.query(
        'UPDATE wd_users SET accountStatusUpdatedAt = COALESCE(updatedAt, createdAt, UNIX_TIMESTAMP()) WHERE accountStatusUpdatedAt IS NULL'
      );
    }
    if (adminFlagWasMissing) {
      await queryInterface.sequelize.query(
        "UPDATE wd_users AS u INNER JOIN wd_roles AS r ON r.id = u.roleId AND r.hostId = u.hostId SET u.isAdminUser = 1 WHERE r.roleCode = 'ADMIN' AND r.isEnabled = 1 AND r.isDeleted = 0 AND u.isDeleted = 0"
      );
    }
  },

  async down() {
    // Forward-only: added identity fields may contain live authentication state.
  },
};