const ApiResponse = require('../../../utils/response');

const infoController = {
  async health(req, res) {
    return ApiResponse.success(res, {
      status: 'healthy',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
    });
  },

  async version(req, res) {
    return ApiResponse.success(res, {
      version: process.env.API_VERSION || '1.0.0',
      environment: process.env.NODE_ENV || 'development',
    });
  },
};

module.exports = infoController;
