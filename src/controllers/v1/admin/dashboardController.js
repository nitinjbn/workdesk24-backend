const { Inquiry, User } = require('../../../models');
const { Op } = require('sequelize');
const ApiResponse = require('../../../utils/response');

const dashboardController = {
  async getStats(req, res) {
    try {
      const totalInquiries = await Inquiry.count();
      const pendingInquiries = await Inquiry.count({ where: { status: 'pending' } });
      const inProgressInquiries = await Inquiry.count({ where: { status: 'in_progress' } });
      const resolvedInquiries = await Inquiry.count({ where: { status: 'resolved' } });
      const totalUsers = await User.count();

      const last30Days = new Date();
      last30Days.setDate(last30Days.getDate() - 30);

      const recentInquiries = await Inquiry.count({
        where: {
          createdAt: {
            [Op.gte]: last30Days,
          },
        },
      });

      return ApiResponse.success(res, {
        inquiries: {
          total: totalInquiries,
          pending: pendingInquiries,
          inProgress: inProgressInquiries,
          resolved: resolvedInquiries,
          last30Days: recentInquiries,
        },
        users: {
          total: totalUsers,
        },
      });
    } catch (error) {
      console.error('Get stats error:', error);
      return ApiResponse.serverError(res, 'Failed to fetch statistics');
    }
  },

  async getRecentInquiries(req, res) {
    try {
      const { limit = 5 } = req.body;

      const inquiries = await Inquiry.findAll({
        limit: parseInt(limit),
        order: [['createdAt', 'DESC']],
        include: [{
          model: User,
          as: 'assignedAdmin',
          attributes: ['id', 'email', 'name'],
        }],
      });

      return ApiResponse.success(res, inquiries);
    } catch (error) {
      console.error('Get recent inquiries error:', error);
      return ApiResponse.serverError(res, 'Failed to fetch recent inquiries');
    }
  },
};

module.exports = dashboardController;
