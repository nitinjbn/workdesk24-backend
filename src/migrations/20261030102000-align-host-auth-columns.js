'use strict';

module.exports = {
  async up(queryInterface, Sequelize) {
    let schema = await queryInterface.describeTable('wd_hosts');
    const additions = [
      ['subDomain', { type: Sequelize.STRING(20), allowNull: true }],
      ['callingCode', { type: Sequelize.STRING(6), allowNull: true }],
      ['landmark', { type: Sequelize.STRING(50), allowNull: true }],
      ['countryName', { type: Sequelize.STRING(50), allowNull: true }],
      ['countryIsoCode', { type: Sequelize.CHAR(2), allowNull: true }],
      ['stateName', { type: Sequelize.STRING(50), allowNull: true }],
      ['stateIsoCode', { type: Sequelize.CHAR(2), allowNull: true }],
      ['district', { type: Sequelize.STRING(50), allowNull: true }],
      ['pinCode', { type: Sequelize.STRING(20), allowNull: true }],
    ];

    for (const [columnName, definition] of additions) {
      if (!schema[columnName]) {
        await queryInterface.addColumn('wd_hosts', columnName, definition);
      }
    }

    schema = await queryInterface.describeTable('wd_hosts');
    if (schema.state && schema.stateName) {
      await queryInterface.sequelize.query(
        'UPDATE wd_hosts SET stateName = state WHERE stateName IS NULL AND state IS NOT NULL'
      );
    }
    if (schema.country && schema.countryName) {
      await queryInterface.sequelize.query(
        'UPDATE wd_hosts SET countryName = country WHERE countryName IS NULL AND country IS NOT NULL'
      );
    }
    if (schema.postalCode && schema.pinCode) {
      await queryInterface.sequelize.query(
        'UPDATE wd_hosts SET pinCode = postalCode WHERE pinCode IS NULL AND postalCode IS NOT NULL'
      );
    }

    await queryInterface.sequelize.query(
      "UPDATE wd_hosts SET subDomain = CONCAT('legacy-', id) WHERE subDomain IS NULL OR TRIM(subDomain) = ''"
    );
    await queryInterface.changeColumn('wd_hosts', 'subDomain', {
      type: Sequelize.STRING(20),
      allowNull: false,
    });
    const indexes = await queryInterface.showIndex('wd_hosts');
    if (!indexes.some((index) => index.unique && index.fields.some((field) => field.attribute === 'subDomain'))) {
      await queryInterface.addIndex('wd_hosts', ['subDomain'], {
        unique: true,
        name: 'uk_hosts_sub_domain',
      });
    }
  },

  async down() {
    // Forward-only to preserve existing host identifiers and address data.
  },
};