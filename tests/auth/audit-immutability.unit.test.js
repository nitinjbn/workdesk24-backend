require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../src/models');
const migration = require('../../src/migrations/20261030123000-create-admin-switch-session-tables');

test.after(async () => {
  await models.sequelize.close();
});

test('audit model rejects instance and bulk update/delete operations', async () => {
  const Audit = models.AdminHostSwitchAudit;
  await assert.rejects(Audit.runHooks('beforeUpdate', {}), /append-only/);
  await assert.rejects(Audit.runHooks('beforeDestroy', {}), /append-only/);
  await assert.rejects(Audit.runHooks('beforeBulkUpdate', {}), /append-only/);
  await assert.rejects(Audit.runHooks('beforeBulkDestroy', {}), /append-only/);
});

test('switch migration installs database update/delete triggers and skips existing triggers', async () => {
  const existingTables = [
    'wd_user_refresh_tokens',
    'wd_user_refresh_token_history',
    'wd_admin_switch_sessions',
    'wd_admin_host_switch_audits',
    'wd_admin_switch_handoffs',
  ];
  const existingIndexes = [
    'idx_refresh_tokens_switch_session',
    'uk_admin_switch_session_id',
    'idx_admin_switch_user_active',
    'idx_admin_switch_token_family',
    'idx_admin_switch_source_family_active',
    'idx_admin_switch_current_host_active',
    'idx_admin_switch_audit_session_time',
    'idx_admin_switch_audit_user_time',
    'idx_admin_switch_audit_host_time',
    'uk_admin_switch_handoff_hash',
    'idx_admin_switch_handoff_user_family_expiry',
    'idx_refresh_history_switch_session',
  ].map((name) => ({ name }));
  const createdTriggers = [];
  const knownTriggers = new Set();
  const queryInterface = {
    async describeTable() {
      return { switchSessionId: {}, contextVersion: {}, sourceTokenFamily: {} };
    },
    async showAllTables() { return existingTables; },
    async showIndex() { return existingIndexes; },
    sequelize: {
      async query(sql, options = {}) {
        if (sql.startsWith('SELECT TRIGGER_NAME')) {
          const triggerName = options.replacements?.triggerName;
          return [triggerName && knownTriggers.has(triggerName) ? [{ TRIGGER_NAME: triggerName }] : []];
        }
        if (sql.startsWith('CREATE TRIGGER')) {
          const triggerName = /CREATE TRIGGER `([^`]+)`/.exec(sql)?.[1];
          createdTriggers.push(triggerName);
          knownTriggers.add(triggerName);
        }
        return [[]];
      },
    },
  };
  const types = {
    STRING: () => 'STRING',
    INTEGER: 'INTEGER',
  };

  await migration.up(queryInterface, types);
  await migration.up(queryInterface, types);

  assert.deepEqual(createdTriggers, [
    'trg_admin_host_switch_audits_no_update',
    'trg_admin_host_switch_audits_no_delete',
  ]);
});