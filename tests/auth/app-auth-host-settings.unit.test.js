require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const { Op } = require('sequelize');
const models = require('../../src/models');
const authService = require('../../src/modules/auth/services/auth.service').default;
const authController = require('../../src/modules/auth/controllers/auth.controller').default;
const userRepository = require('../../src/modules/auth/repositories/user.repository').default;
const { APP_HOST_SETTINGS } = require('../../src/config/constants');
const { getHostSettingsValues } = require('../../src/shared/utils/host-settings.util');

test.after(async () => {
  await models.sequelize.close();
});

const tokens = {
  accessToken: 'access-token',
  refreshToken: 'refresh-token',
};

const subscription = {
  status: 'ACTIVE',
  canUseApp: true,
  isReadOnly: false,
  canRenew: false,
  message: '',
};

function createUser(hostId) {
  return {
    id: 47,
    hostId,
    email: 'employee@example.com',
    name: 'Employee',
    password: 'password-hash',
    roleId: 3,
    accountStatus: 'ACTIVE',
    isFieldAppUser: 1,
  };
}

function createResponse() {
  return {
    statusCode: 200,
    body: undefined,
    status(statusCode) {
      this.statusCode = statusCode;
      return this;
    },
    json(body) {
      this.body = body;
      return this;
    },
  };
}

function mockAppAuthDependencies(context, user) {
  context.mock.method(authService, 'resolveUserDeviceId', async () => 'device-47');
  context.mock.method(authService, 'createUserSessionTokens', async () => tokens);
  context.mock.method(authService, 'getPermissionsByModuleForUser', async () => []);
  context.mock.method(authService, 'getSubscriptionStatusForHost', async () => subscription);
  context.mock.method(userRepository, 'getAttendanceSitesForUser', async () => []);
  context.mock.method(userRepository, 'updateUserDeviceDetails', async () => ({}));
  context.mock.method(userRepository, 'unregisterUserOtherDevices', async () => ({}));
  context.mock.method(userRepository, 'findById', async () => user);
  context.mock.method(models.UserSettings, 'findAll', async () => [
    { settingName: 'attendanceSelfieRequired', settingValue: '1' },
  ]);
}

test('login and refresh return host settings from the current authenticated host', async (context) => {
  const hostId = 17;
  const user = createUser(hostId);
  let hostSettings = {
    orderShareHeaderText: 'Initial header',
    orderShareFooterText: 'Initial footer',
  };
  const queriedHostIds = [];

  mockAppAuthDependencies(context, user);
  context.mock.method(authService, 'validateCredentials', async () => user);
  context.mock.method(authService, 'verifyRefreshToken', () => ({
    userId: user.id,
    hostId: 999,
    tokenFamily: 'family-47',
    tokenType: 'refresh',
  }));
  context.mock.method(authService, 'rotateUserSessionTokens', async () => tokens);
  context.mock.method(models.HostSettings, 'findAll', async (options) => {
    queriedHostIds.push(options.where.hostId);
    assert.equal(options.where.hostId, hostId);
    assert.equal(options.where.isEnabled, 1);
    assert.equal(options.where.isDeleted, 0);
    assert.deepEqual(options.where.settingName[Op.in], APP_HOST_SETTINGS);
    return Object.entries(hostSettings).map(([settingName, settingValue]) => ({
      settingName,
      settingValue,
    }));
  });

  const loginResponse = createResponse();
  await authController.login(
    {
      body: {
        email: user.email,
        password: 'password',
        hostId: 999,
        deviceDetails: { deviceId: 'device-47' },
      },
    },
    loginResponse,
    (error) => {
      if (error) throw error;
    }
  );

  assert.equal(loginResponse.body.success, true);
  assert.deepEqual(loginResponse.body.data.hostSettings, hostSettings);
  assert.equal(loginResponse.body.data.user.settings.attendanceSelfieRequired, 1);
  assert.deepEqual(loginResponse.body.data.subscription, subscription);

  hostSettings = {
    orderShareHeaderText: 'Updated header',
    orderShareFooterText: 'Updated footer',
  };
  const refreshResponse = createResponse();
  await authController.refresh(
    { headers: { 'x-refresh-token': 'refresh-token' } },
    refreshResponse,
    (error) => {
      if (error) throw error;
    }
  );

  assert.equal(refreshResponse.body.success, true);
  assert.deepEqual(refreshResponse.body.data.hostSettings, hostSettings);
  assert.equal(refreshResponse.body.data.user.settings.attendanceSelfieRequired, 1);
  assert.deepEqual(refreshResponse.body.data.subscription, subscription);
  assert.deepEqual(queriedHostIds, [hostId, hostId]);
  assert.deepEqual(
    Object.keys(refreshResponse.body.data.hostSettings).sort(),
    Object.keys(loginResponse.body.data.hostSettings).sort()
  );
});

test('app host settings are host-scoped and return a stable nullable shape', async (context) => {
  const keyValueRecords = new Map([
    [
      4,
      [
        { settingName: 'orderShareHeaderText', settingValue: 'Host four' },
      ],
    ],
    [
      5,
      [
        { settingName: 'orderShareFooterText', settingValue: 'Host five' },
      ],
    ],
  ]);

  context.mock.method(models.HostSettings, 'findAll', async (options) => {
    assert.equal(options.where.isEnabled, 1);
    assert.equal(options.where.isDeleted, 0);
    assert.deepEqual(options.where.settingName[Op.in], APP_HOST_SETTINGS);
    return keyValueRecords.get(options.where.hostId) || [];
  });

  const emptySettings = Object.fromEntries(APP_HOST_SETTINGS.map((name) => [name, null]));
  const hostFourSettings = await getHostSettingsValues(4, [...APP_HOST_SETTINGS]);
  const hostFiveSettings = await getHostSettingsValues(5, [...APP_HOST_SETTINGS]);
  const missingHostSettings = await getHostSettingsValues(6, [...APP_HOST_SETTINGS]);

  assert.deepEqual(hostFourSettings, {
    ...emptySettings,
    orderShareHeaderText: 'Host four',
    orderShareFooterText: null,
  });
  assert.deepEqual(hostFiveSettings, {
    ...emptySettings,
    orderShareHeaderText: null,
    orderShareFooterText: 'Host five',
  });
  assert.deepEqual(missingHostSettings, emptySettings);
});

test('verify OTP returns the same app authentication fields as login and refresh', async (context) => {
  const hostId = 24;
  const user = createUser(hostId);
  const hostSettings = {
    orderShareHeaderText: 'OTP header',
    orderShareFooterText: 'OTP footer',
  };
  const otpEntry = {
    id: 8,
    status: 'PENDING',
    expiresAt: Math.floor(Date.now() / 1000) + 600,
    attemptCount: 1,
    maxAttempts: 5,
    async reload() {},
    async compareOtp() {
      return true;
    },
  };

  mockAppAuthDependencies(context, user);
  context.mock.method(authService, 'getUserByIdentifier', async () => user);
  context.mock.method(userRepository, 'findLatestOtpByIdentifier', async (options) => {
    assert.equal(options.hostId, hostId);
    return otpEntry;
  });
  context.mock.method(userRepository, 'incrementOtpAttempt', async () => ({}));
  context.mock.method(userRepository, 'updateOtpStatus', async () => ({}));
  context.mock.method(models.HostSettings, 'findAll', async (options) => {
    assert.equal(options.where.hostId, hostId);
    assert.deepEqual(options.where.settingName[Op.in], APP_HOST_SETTINGS);
    return Object.entries(hostSettings).map(([settingName, settingValue]) => ({
      settingName,
      settingValue,
    }));
  });

  const response = createResponse();
  await authController.verifyOtp(
    {
      body: {
        identifier: user.email,
        otpCode: '123456',
        deviceDetails: { deviceId: 'device-47' },
      },
    },
    response,
    (error) => {
      if (error) throw error;
    }
  );

  assert.equal(response.body.success, true);
  assert.deepEqual(response.body.data.hostSettings, hostSettings);
  assert.deepEqual(response.body.data.subscription, subscription);
  assert.deepEqual(response.body.data.permissions, []);
  assert.equal(response.body.data.user.settings.attendanceSelfieRequired, 1);
});
