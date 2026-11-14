'use strict';

module.exports = {
  async up(queryInterface) {
    const fs = require('fs');
    const path = require('path');
    // Keep the manual deployment SQL and the migration schema identical.
    const sql = fs.readFileSync(path.join(__dirname, '..', '..', 'docs', 'TASK_TAGS.sql'), 'utf8');
    const statements = sql.replace(/^--.*$/gm, '').split(';').map((statement) => statement.trim());
    for (const statement of statements.filter((entry) => entry.startsWith('CREATE TABLE'))) {
      await queryInterface.sequelize.query(statement);
    }
  },

  async down() {
    throw new Error('Task tags retain historical mappings. Automatic destructive rollback is not supported.');
  },
};
