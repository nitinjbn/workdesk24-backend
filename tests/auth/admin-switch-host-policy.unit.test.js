require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../src/models');
const hostService = require('../../src/modules/master/services/host.service').default;
const hostRepository = require('../../src/modules/master/repositories/host.repository').default;
const hostDateTimeSettings = require('../../src/shared/utils/host-settings.util');
const { DateTimeFormatUtil } = require('../../src/shared/utils/date-time-format.util');

test.after(async () => {
  await models.sequelize.close();
});

async function getAccessMode(context, subscription) {
  context.mock.method(hostDateTimeSettings, 'getHostDateTimeSettings', async () => ({ timeZone: 'UTC' }));
  context.mock.method(DateTimeFormatUtil, 'getCurrentDateInTimeZone', () => '2026-10-30');
  context.mock.method(hostRepository, 'getHostSwitchContext', async () => ({
    host: { toJSON: () => ({ id: 44, isActive: 1, isDeleted: 0 }) },
    subscription: subscription ? { ...subscription, toJSON: () => subscription } : null,
  }));

  return hostService.getSwitchHostContext(44);
}

test('active enabled paid subscription grants full support access', async (context) => {
  const result = await getAccessMode(context, {
    isEnabled: 1,
    paymentStatus: 'PAID',
  });

  assert.equal(result.accessMode, 'SUPPORT_FULL');
});

test('absent subscription grants read-only support access', async (context) => {
  const result = await getAccessMode(context, null);

  assert.equal(result.accessMode, 'SUPPORT_READ_ONLY');
});

test('disabled and unpaid subscriptions grant read-only support access', async (context) => {
  const disabled = await getAccessMode(context, {
    isEnabled: 0,
    paymentStatus: 'PAID',
  });

  assert.equal(disabled.accessMode, 'SUPPORT_READ_ONLY');

  const unpaid = await getAccessMode(context, {
    isEnabled: 1,
    paymentStatus: 'PENDING',
  });

  assert.equal(unpaid.accessMode, 'SUPPORT_READ_ONLY');
});

test('inactive or deleted host is ineligible', async (context) => {
  context.mock.method(hostDateTimeSettings, 'getHostDateTimeSettings', async () => ({ timeZone: 'UTC' }));
  context.mock.method(DateTimeFormatUtil, 'getCurrentDateInTimeZone', () => '2026-10-30');
  context.mock.method(hostRepository, 'getHostSwitchContext', async () => ({
    host: null,
    subscription: null,
  }));

  assert.equal(await hostService.getSwitchHostContext(44), null);
});