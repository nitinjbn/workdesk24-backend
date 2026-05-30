const ApiResponse = require('../../../utils/response');

const dataController = {
  async getData(req, res) {
    try {
      return ApiResponse.success(res, {
        message: 'App data endpoint - implement your business logic here',
        userId: req.user.id,
      });
    } catch (error) {
      console.error('Get data error:', error);
      return ApiResponse.serverError(res, 'Failed to fetch data');
    }
  },

  async createData(req, res) {
    try {
      return ApiResponse.created(res, {
        message: 'Data created - implement your business logic here',
        userId: req.user.id,
        data: req.body,
      });
    } catch (error) {
      console.error('Create data error:', error);
      return ApiResponse.serverError(res, 'Failed to create data');
    }
  },
};

module.exports = dataController;
