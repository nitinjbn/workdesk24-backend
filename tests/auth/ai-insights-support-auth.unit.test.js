require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');
const models = require('../../src/models');
const { AiInsightsController } = require('../../src/modules/ai-insights/controllers/ai-insights.controller');
const { InsightPermissionService } = require('../../src/modules/ai-insights/services/insight-permission.service');

test.after(async () => {
  await models.sequelize.close();
});

function response() {
  return {
    statusCode: 200,
    body: null,
    status(code) { this.statusCode = code; return this; },
    json(body) { this.body = body; return this; },
  };
}

test('all AI Insights endpoints keep the original user and use the switched host support context', async () => {
  const calls = [];
  const service = {
    async getCategories(payload) { calls.push(['categories', payload]); return []; },
    async getQuestion(payload) { calls.push(['question', payload]); return {}; },
    async executeInsight(payload) { calls.push(['query', payload]); return {}; },
  };
  const controller = new AiInsightsController(service);
  const req = {
    user: { id: 7, hostId: 41, isSuperAdmin: 1, isAdminUser: 0 },
    authContext: { isSupportSession: true, switchSessionId: 'switch-id', originalHostId: 5, currentHostId: 41 },
    params: { insightId: 'attendance.earliest' },
    body: {
      insightId: 'attendance.earliest',
      filters: { date: { type: 'preset', value: 'today' } },
    },
  };
  const next = (error) => { if (error) throw error; };

  await controller.getCategories(req, response(), next);
  await controller.getQuestion(req, response(), next);
  await controller.executeInsight(req, response(), next);

  assert.deepEqual(calls.map(([name]) => name), ['categories', 'question', 'query']);
  for (const [, payload] of calls) {
    assert.equal(payload.hostId, 41);
    assert.equal(payload.userId, 7);
    assert.equal(payload.isSupportSession, true);
  }
});

test('normal AI Insights access still requires a user record in the selected host', async (context) => {
  const permissionService = new InsightPermissionService();
  const findOne = context.mock.method(models.User, 'findOne', async () => null);

  await assert.rejects(
    permissionService.validateAccess({ hostId: 41, userId: 7, isSupportSession: false }),
    { code: 'ACCESS_DENIED' }
  );
  assert.equal(findOne.mock.callCount(), 1);
});

test('AI Insights support permission bypass does not query or impersonate a target user', async (context) => {
  const permissionService = new InsightPermissionService();
  const findOne = context.mock.method(models.User, 'findOne', async () => null);

  await permissionService.validateAccess({ hostId: 41, userId: 7, isSupportSession: true });

  assert.equal(findOne.mock.callCount(), 0);
});