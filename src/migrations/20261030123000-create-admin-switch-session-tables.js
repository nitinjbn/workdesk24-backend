'use strict';

const TABLE_NAMES = [
  'wd_admin_switch_sessions',
  'wd_admin_host_switch_audits',
  'wd_admin_switch_handoffs',
];

async function ensureIndex(queryInterface, tableName, fields, name, options = {}) {
  const indexes = await queryInterface.showIndex(tableName);
  if (!indexes.some((index) => index.name === name)) {
    await queryInterface.addIndex(tableName, fields, { ...options, name });
  }
}

async function ensureAuditImmutabilityTriggers(queryInterface) {
  const triggers = [
    {
      name: 'trg_admin_host_switch_audits_no_update',
      event: 'UPDATE',
    },
    {
      name: 'trg_admin_host_switch_audits_no_delete',
      event: 'DELETE',
    },
  ];

  for (const trigger of triggers) {
    const [rows] = await queryInterface.sequelize.query(
      'SELECT TRIGGER_NAME FROM information_schema.TRIGGERS WHERE TRIGGER_SCHEMA = DATABASE() AND TRIGGER_NAME = :triggerName',
      { replacements: { triggerName: trigger.name } }
    );
    if (rows.length > 0) {
      continue;
    }

    await queryInterface.sequelize.query(
      `CREATE TRIGGER \`${trigger.name}\` BEFORE ${trigger.event} ON wd_admin_host_switch_audits FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Host switch audit is append-only'`
    );
  }
}

module.exports = {
  async up(queryInterface, Sequelize) {
    let refreshTokenSchema;
    try {
      refreshTokenSchema = await queryInterface.describeTable('wd_user_refresh_tokens');
    } catch {
      throw new Error('Verified table wd_user_refresh_tokens is required before switch-session migration.');
    }

    if (!refreshTokenSchema.switchSessionId) {
      await queryInterface.addColumn('wd_user_refresh_tokens', 'switchSessionId', {
        type: Sequelize.STRING(36),
        allowNull: true,
        defaultValue: null,
      });
    }
    if (!refreshTokenSchema.contextVersion) {
      await queryInterface.addColumn('wd_user_refresh_tokens', 'contextVersion', {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: null,
      });
    }
    const refreshIndexes = await queryInterface.showIndex('wd_user_refresh_tokens');
    if (!refreshIndexes.some((index) => index.name === 'idx_refresh_tokens_switch_session')) {
      await queryInterface.addIndex('wd_user_refresh_tokens', ['switchSessionId'], {
        name: 'idx_refresh_tokens_switch_session',
      });
    }

    const tables = await queryInterface.showAllTables();
    if (!tables.includes('wd_admin_switch_sessions')) {
      await queryInterface.createTable('wd_admin_switch_sessions', {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        switchSessionId: { type: Sequelize.STRING(36), allowNull: false },
        userId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        originalHostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        sourceTokenFamily: { type: Sequelize.STRING(64), allowNull: false },
        currentHostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        tokenFamily: { type: Sequelize.STRING(64), allowNull: false },
        deviceId: { type: Sequelize.STRING(255), allowNull: false },
        currentRefreshTokenId: { type: Sequelize.BIGINT, allowNull: true },
        contextVersion: { type: Sequelize.INTEGER, allowNull: false, defaultValue: 1 },
        isActive: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 1 },
        startedAt: { type: Sequelize.BIGINT, allowNull: false },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: false },
        endedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
    }

    const switchSessionSchema = await queryInterface.describeTable('wd_admin_switch_sessions');
    if (!switchSessionSchema.sourceTokenFamily) {
      await queryInterface.addColumn('wd_admin_switch_sessions', 'sourceTokenFamily', {
        type: Sequelize.STRING(64),
        allowNull: true,
        defaultValue: null,
      });
    }

    await ensureIndex(
      queryInterface,
      'wd_admin_switch_sessions',
      ['switchSessionId'],
      'uk_admin_switch_session_id',
      { unique: true }
    );

    if (!tables.includes('wd_admin_host_switch_audits')) {
      await queryInterface.createTable('wd_admin_host_switch_audits', {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        switchSessionId: {
          type: Sequelize.STRING(36),
          allowNull: false,
          references: { model: 'wd_admin_switch_sessions', key: 'switchSessionId' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        originalUserId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        originalHostId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        previousHostId: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        newHostId: {
          type: Sequelize.BIGINT,
          allowNull: true,
          references: { model: 'wd_hosts', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        eventType: { type: Sequelize.ENUM('SWITCH', 'SESSION_TERMINATED'), allowNull: false },
        contextVersion: { type: Sequelize.INTEGER, allowNull: false },
        requestIp: { type: Sequelize.STRING(45), allowNull: true },
        userAgent: { type: Sequelize.STRING(512), allowNull: true },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: false },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
    }

    if (!tables.includes('wd_admin_switch_handoffs')) {
      await queryInterface.createTable('wd_admin_switch_handoffs', {
        id: { type: Sequelize.BIGINT, autoIncrement: true, primaryKey: true },
        tokenHash: { type: Sequelize.STRING(64), allowNull: false },
        userId: {
          type: Sequelize.BIGINT,
          allowNull: false,
          references: { model: 'wd_users', key: 'id' },
          onUpdate: 'CASCADE',
          onDelete: 'RESTRICT',
        },
        tokenFamily: { type: Sequelize.STRING(64), allowNull: false },
        expiresAt: { type: Sequelize.BIGINT, allowNull: false },
        consumedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
        createdAt: { type: Sequelize.BIGINT, allowNull: false },
        updatedAt: { type: Sequelize.BIGINT, allowNull: false },
        isDeleted: { type: Sequelize.TINYINT, allowNull: false, defaultValue: 0 },
        deletedAt: { type: Sequelize.BIGINT, allowNull: true, defaultValue: null },
      });
    }

    await ensureIndex(queryInterface, 'wd_admin_switch_sessions', ['switchSessionId'], 'uk_admin_switch_session_id', { unique: true });
    await ensureIndex(queryInterface, 'wd_admin_switch_sessions', ['userId', 'isActive'], 'idx_admin_switch_user_active');
    await ensureIndex(queryInterface, 'wd_admin_switch_sessions', ['tokenFamily'], 'idx_admin_switch_token_family');
    await ensureIndex(queryInterface, 'wd_admin_switch_sessions', ['userId', 'sourceTokenFamily', 'isActive'], 'idx_admin_switch_source_family_active');
    await ensureIndex(queryInterface, 'wd_admin_switch_sessions', ['currentHostId', 'isActive'], 'idx_admin_switch_current_host_active');
    await ensureIndex(queryInterface, 'wd_admin_host_switch_audits', ['switchSessionId', 'createdAt'], 'idx_admin_switch_audit_session_time');
    await ensureIndex(queryInterface, 'wd_admin_host_switch_audits', ['originalUserId', 'createdAt'], 'idx_admin_switch_audit_user_time');
    await ensureIndex(queryInterface, 'wd_admin_host_switch_audits', ['newHostId', 'createdAt'], 'idx_admin_switch_audit_host_time');
    await ensureIndex(queryInterface, 'wd_admin_switch_handoffs', ['tokenHash'], 'uk_admin_switch_handoff_hash', { unique: true });
    await ensureIndex(queryInterface, 'wd_admin_switch_handoffs', ['userId', 'tokenFamily', 'expiresAt'], 'idx_admin_switch_handoff_user_family_expiry');
    await ensureAuditImmutabilityTriggers(queryInterface);

    const historySchema = await queryInterface.describeTable('wd_user_refresh_token_history');
    if (!historySchema.switchSessionId) {
      await queryInterface.addColumn('wd_user_refresh_token_history', 'switchSessionId', {
        type: Sequelize.STRING(36), allowNull: true, defaultValue: null,
      });
    }
    if (!historySchema.contextVersion) {
      await queryInterface.addColumn('wd_user_refresh_token_history', 'contextVersion', {
        type: Sequelize.INTEGER, allowNull: true, defaultValue: null,
      });
    }
    await ensureIndex(
      queryInterface,
      'wd_user_refresh_token_history',
      ['switchSessionId'],
      'idx_refresh_history_switch_session'
    );
  },

  async down(queryInterface) {
    const tables = await queryInterface.showAllTables();
    const [boundHistoryRows] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS rowCount FROM wd_user_refresh_token_history WHERE switchSessionId IS NOT NULL'
    );
    if (Number(boundHistoryRows[0].rowCount) > 0) {
      throw new Error('Refusing to remove switch columns while switched refresh history is retained.');
    }
    const [boundRefreshRows] = await queryInterface.sequelize.query(
      'SELECT COUNT(*) AS rowCount FROM wd_user_refresh_tokens WHERE switchSessionId IS NOT NULL'
    );
    if (Number(boundRefreshRows[0].rowCount) > 0) {
      throw new Error('Refusing to remove switch columns while refresh sessions are active or retained.');
    }

    for (const tableName of TABLE_NAMES) {
      if (!tables.includes(tableName)) {
        continue;
      }
      const [rows] = await queryInterface.sequelize.query(
        `SELECT COUNT(*) AS rowCount FROM ${tableName}`
      );
      if (Number(rows[0].rowCount) > 0) {
        throw new Error(`Refusing to drop populated authentication table ${tableName}.`);
      }
    }

    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS `trg_admin_host_switch_audits_no_update`'
    );
    await queryInterface.sequelize.query(
      'DROP TRIGGER IF EXISTS `trg_admin_host_switch_audits_no_delete`'
    );

    for (const tableName of [...TABLE_NAMES].reverse()) {
      if (tables.includes(tableName)) {
        await queryInterface.dropTable(tableName);
      }
    }

    const refreshSchema = await queryInterface.describeTable('wd_user_refresh_tokens');
    const refreshIndexes = await queryInterface.showIndex('wd_user_refresh_tokens');
    if (refreshIndexes.some((index) => index.name === 'idx_refresh_tokens_switch_session')) {
      await queryInterface.removeIndex('wd_user_refresh_tokens', 'idx_refresh_tokens_switch_session');
    }
    if (refreshSchema.switchSessionId) {
      await queryInterface.removeColumn('wd_user_refresh_tokens', 'switchSessionId');
    }
    if (refreshSchema.contextVersion) {
      await queryInterface.removeColumn('wd_user_refresh_tokens', 'contextVersion');
    }

    const historySchema = await queryInterface.describeTable('wd_user_refresh_token_history');
    if (historySchema.switchSessionId) {
      const historyIndexes = await queryInterface.showIndex('wd_user_refresh_token_history');
      if (historyIndexes.some((index) => index.name === 'idx_refresh_history_switch_session')) {
        await queryInterface.removeIndex(
          'wd_user_refresh_token_history',
          'idx_refresh_history_switch_session'
        );
      }
      await queryInterface.removeColumn('wd_user_refresh_token_history', 'switchSessionId');
    }
    if (historySchema.contextVersion) {
      await queryInterface.removeColumn('wd_user_refresh_token_history', 'contextVersion');
    }
  },
};