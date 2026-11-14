'use strict';

const CATEGORIES = 'wd_task_categories';
const TASKS = 'wd_tasks';
const SETTINGS = 'wd_task_settings';

function assertPrefix(prefix) {
  if (typeof prefix !== 'string' || !prefix.trim() || prefix !== prefix.trim() || Array.from(prefix).length > 20) {
    throw new Error('Invalid legacy task prefix; repair wd_task_settings before migrating task categories');
  }
}

function nextCounter(stored, maximum, prefix) {
  if (!/^[1-9]\d*$/.test(String(stored))) throw new Error('Invalid legacy task counter');
  const next = BigInt(stored) > BigInt(maximum) ? BigInt(stored) : BigInt(maximum) + 1n;
  if (next >= 9223372036854775807n || Array.from(`${prefix}${prefix.endsWith('-') ? '' : '-'}${next}`).length > 30) {
    throw new Error('Migrated task counter would overflow the existing task number format');
  }
  return String(next);
}

module.exports = {
  async up(queryInterface, Sequelize) {
    const select = (sql, options = {}) => queryInterface.sequelize.query(sql, {
      ...options, type: Sequelize.QueryTypes.SELECT,
    });
    // MySQL DDL implicitly commits. Keep schema steps restartable and backfill DML atomic.
    const duplicates = await select(
      `SELECT hostId FROM ${TASKS} WHERE taskNumber IS NOT NULL
       GROUP BY hostId, taskNumber HAVING COUNT(*) > 1 LIMIT 1`
    );
    if (duplicates.length) throw new Error('Duplicate host/taskNumber values exist; repair them before migrating task categories');
    const orphanHosts = await select(
      `SELECT source.hostId FROM
         (SELECT hostId FROM ${SETTINGS} UNION SELECT hostId FROM ${TASKS}) source
       LEFT JOIN wd_hosts h ON h.id = source.hostId WHERE h.id IS NULL LIMIT 1`
    );
    if (orphanHosts.length) throw new Error('Orphan task/settings host exists; repair host ownership before migrating');

    const tables = (await queryInterface.showAllTables()).map((table) =>
      typeof table === 'string' ? table : table.tableName);
    if (!tables.includes(CATEGORIES)) {
      await queryInterface.createTable(CATEGORIES, {
        id: { type: Sequelize.BIGINT, primaryKey: true, autoIncrement: true },
        hostId: {
          type: Sequelize.BIGINT, allowNull: false,
          references: { model: 'wd_hosts', key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE',
        },
        name: { type: Sequelize.STRING(100), allowNull: false },
        description: { type: Sequelize.STRING(500), allowNull: true },
        taskNumberPrefix: { type: Sequelize.STRING(20), allowNull: false },
        nextTaskNumber: { type: Sequelize.BIGINT, allowNull: false, defaultValue: 1 },
        isEnabled: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: true },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
    }
    const categorySchema = await queryInterface.describeTable(CATEGORIES);
    if (!categorySchema.activeName) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ${CATEGORIES} ADD COLUMN activeName VARCHAR(100)
         GENERATED ALWAYS AS (CASE WHEN isDeleted = 0 THEN name ELSE NULL END) STORED`
      );
    }
    if (!categorySchema.activePrefix) {
      await queryInterface.sequelize.query(
        `ALTER TABLE ${CATEGORIES} ADD COLUMN activePrefix VARCHAR(21)
         GENERATED ALWAYS AS (CASE WHEN isDeleted = 0 THEN
           CASE WHEN RIGHT(taskNumberPrefix, 1) = '-' THEN taskNumberPrefix
                ELSE CONCAT(taskNumberPrefix, '-') END ELSE NULL END) STORED`
      );
    }
    const addIndex = async (table, fields, name, unique = false) => {
      const indexes = await queryInterface.showIndex(table);
      if (!indexes.some((index) => index.name === name)) {
        await queryInterface.addIndex(table, fields, { name, unique });
      }
    };
    await addIndex(CATEGORIES, ['hostId'], 'idx_task_categories_host');
    await addIndex(CATEGORIES, ['isEnabled'], 'idx_task_categories_enabled');
    await addIndex(CATEGORIES, ['isDeleted'], 'idx_task_categories_deleted');
    await addIndex(CATEGORIES, ['hostId', 'activeName'], 'uq_task_categories_host_name', true);
    await addIndex(CATEGORIES, ['hostId', 'activePrefix'], 'uq_task_categories_host_prefix', true);

    const taskSchema = await queryInterface.describeTable(TASKS);
    if (!taskSchema.taskCategoryId) {
      await queryInterface.addColumn(TASKS, 'taskCategoryId', {
        type: Sequelize.BIGINT, allowNull: true,
        references: { model: CATEGORIES, key: 'id' }, onDelete: 'RESTRICT', onUpdate: 'CASCADE',
      });
    }
    await addIndex(TASKS, ['taskCategoryId'], 'idx_tasks_category');
    await addIndex(TASKS, ['hostId', 'taskNumber'], 'uq_wd_tasks_host_taskNumber', true);

    await queryInterface.sequelize.transaction(async (transaction) => {
      const hosts = await select(
        `SELECT source.hostId, s.taskNumberPrefix, CAST(s.nextTaskNumber AS CHAR) AS nextTaskNumber, s.createdAt
         FROM (SELECT hostId FROM ${SETTINGS} UNION SELECT hostId FROM ${TASKS}) source
         LEFT JOIN ${SETTINGS} s ON s.hostId = source.hostId`,
        { transaction }
      );
      for (const host of hosts) {
        const prefix = host.taskNumberPrefix == null ? 'TASK-' : host.taskNumberPrefix;
        assertPrefix(prefix);
        const separatorPrefix = prefix.endsWith('-') ? prefix : `${prefix}-`;
        const [maximum] = await select(
          `SELECT CAST(COALESCE(MAX(CAST(SUBSTRING(taskNumber, :start) AS DECIMAL(20,0))), 0) AS CHAR) AS maximum
           FROM ${TASKS} WHERE hostId = :hostId
             AND LEFT(taskNumber, CHAR_LENGTH(:prefix)) = :prefix
             AND SUBSTRING(taskNumber, :start) REGEXP '^[1-9][0-9]*$'`,
          { replacements: { hostId: host.hostId, prefix: separatorPrefix, start: Array.from(separatorPrefix).length + 1 }, transaction }
        );
        const next = nextCounter(host.nextTaskNumber == null ? '1' : host.nextTaskNumber, maximum.maximum, prefix);
        const now = Math.floor(Date.now() / 1000);
        await queryInterface.sequelize.query(
          `INSERT INTO ${CATEGORIES}
           (hostId, name, description, taskNumberPrefix, nextTaskNumber, isEnabled, isDeleted, createdAt)
           VALUES (:hostId, 'General', 'Default category migrated from existing task settings', :prefix, :next, 1, 0, :createdAt)
           ON DUPLICATE KEY UPDATE nextTaskNumber = GREATEST(nextTaskNumber, VALUES(nextTaskNumber))`,
          { replacements: { hostId: host.hostId, prefix, next, createdAt: host.createdAt || now }, transaction }
        );
        const [category] = await select(
          `SELECT id, taskNumberPrefix FROM ${CATEGORIES} WHERE hostId = :hostId AND name = 'General' AND isDeleted = 0`,
          { replacements: { hostId: host.hostId }, transaction }
        );
        if (!category || category.taskNumberPrefix !== prefix) {
          throw new Error('General category conflicts with legacy task settings; backfill rolled back');
        }
        await queryInterface.sequelize.query(
          `UPDATE ${TASKS} SET taskCategoryId = :categoryId WHERE hostId = :hostId AND taskCategoryId IS NULL`,
          { replacements: { categoryId: category.id, hostId: host.hostId }, transaction }
        );
      }
      const invalid = await select(
        `SELECT t.id FROM ${TASKS} t LEFT JOIN ${CATEGORIES} c ON c.id = t.taskCategoryId AND c.hostId = t.hostId
         WHERE c.id IS NULL LIMIT 1`, { transaction }
      );
      if (invalid.length) throw new Error('Task category ownership verification failed; backfill rolled back');
    });
  },

  async down(queryInterface, Sequelize) {
    // Stop all task/category writes before rollback. Multiple used categories cannot
    // be represented by one legacy counter, so refuse that lossy downgrade.
    await queryInterface.sequelize.transaction(async (transaction) => {
      const used = await queryInterface.sequelize.query(
        `SELECT t.id FROM ${TASKS} t JOIN ${CATEGORIES} c ON c.id = t.taskCategoryId
         WHERE c.name <> 'General' OR c.isDeleted <> 0 OR c.hostId <> t.hostId LIMIT 1`,
        { type: Sequelize.QueryTypes.SELECT, transaction }
      );
      if (used.length) throw new Error('Cannot roll back used custom/deleted task categories; restore a backup or explicitly reconcile numbering first');
      await queryInterface.sequelize.query(
        `INSERT INTO ${SETTINGS} (hostId, taskNumberPrefix, nextTaskNumber, createdAt, updatedAt)
         SELECT hostId, taskNumberPrefix, nextTaskNumber, createdAt, updatedAt
         FROM ${CATEGORIES} WHERE name = 'General' AND isDeleted = 0
         ON DUPLICATE KEY UPDATE taskNumberPrefix = VALUES(taskNumberPrefix),
           nextTaskNumber = GREATEST(${SETTINGS}.nextTaskNumber, VALUES(nextTaskNumber)), updatedAt = VALUES(updatedAt)`,
        { transaction }
      );
    });
    const taskSchema = await queryInterface.describeTable(TASKS);
    if (taskSchema.taskCategoryId) await queryInterface.removeColumn(TASKS, 'taskCategoryId');
    await queryInterface.dropTable(CATEGORIES);
    // The host/taskNumber uniqueness guard remains valid for the legacy allocator.
  },
};
