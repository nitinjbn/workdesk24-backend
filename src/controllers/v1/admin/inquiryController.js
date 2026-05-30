const { Inquiry, User } = require('../../../models');
const ApiResponse = require('../../../utils/response');

const inquiryController = {
  async getAllInquiries(req, res) {
    try {
      const { page = 1, limit = 10, status, priority } = req.body;
      const offset = (page - 1) * limit;

      const where = {};
      if (status) where.status = status;
      if (priority) where.priority = priority;

      const { rows, count } = await Inquiry.findAndCountAll({
        where,
        include: [{
          model: User,
          as: 'assignedAdmin',
          attributes: ['id', 'email', 'name'],
        }],
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
      });

      return ApiResponse.success(res, {
        inquiries: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      console.error('Get inquiries error:', error);
      return ApiResponse.serverError(res, 'Failed to fetch inquiries');
    }
  },

  async getInquiryById(req, res) {
    try {
      const { id } = req.body;

      const inquiry = await Inquiry.findByPk(id, {
        include: [{
          model: User,
          as: 'assignedAdmin',
          attributes: ['id', 'email', 'name'],
        }],
      });

      if (!inquiry) {
        return ApiResponse.notFound(res, 'Inquiry not found');
      }

      return ApiResponse.success(res, inquiry);
    } catch (error) {
      console.error('Get inquiry error:', error);
      return ApiResponse.serverError(res, 'Failed to fetch inquiry');
    }
  },

  async updateInquiry(req, res) {
    try {
      const { id, priority, adminNotes } = req.body;

      const inquiry = await Inquiry.findByPk(id);
      if (!inquiry) {
        return ApiResponse.notFound(res, 'Inquiry not found');
      }

      if (priority) inquiry.priority = priority;
      if (adminNotes !== undefined) inquiry.adminNotes = adminNotes;

      await inquiry.save();

      return ApiResponse.success(res, inquiry, 'Inquiry updated successfully');
    } catch (error) {
      console.error('Update inquiry error:', error);
      return ApiResponse.serverError(res, 'Failed to update inquiry');
    }
  },

  async deleteInquiry(req, res) {
    try {
      const { id } = req.body;

      const inquiry = await Inquiry.findByPk(id);
      if (!inquiry) {
        return ApiResponse.notFound(res, 'Inquiry not found');
      }

      await inquiry.destroy();

      return ApiResponse.success(res, null, 'Inquiry deleted successfully');
    } catch (error) {
      console.error('Delete inquiry error:', error);
      return ApiResponse.serverError(res, 'Failed to delete inquiry');
    }
  },

  async assignInquiry(req, res) {
    try {
      const { id, adminId } = req.body;

      const inquiry = await Inquiry.findByPk(id);
      if (!inquiry) {
        return ApiResponse.notFound(res, 'Inquiry not found');
      }

      if (adminId) {
        const admin = await User.findByPk(adminId);
        if (!admin) {
          return ApiResponse.notFound(res, 'Admin user not found');
        }
      }

      inquiry.assignedTo = adminId || null;
      await inquiry.save();

      return ApiResponse.success(res, inquiry, 'Inquiry assigned successfully');
    } catch (error) {
      console.error('Assign inquiry error:', error);
      return ApiResponse.serverError(res, 'Failed to assign inquiry');
    }
  },

  async updateStatus(req, res) {
    try {
      const { id, status } = req.body;

      if (!['pending', 'in_progress', 'resolved', 'closed'].includes(status)) {
        return ApiResponse.badRequest(res, 'Invalid status value');
      }

      const inquiry = await Inquiry.findByPk(id);
      if (!inquiry) {
        return ApiResponse.notFound(res, 'Inquiry not found');
      }

      inquiry.status = status;
      await inquiry.save();

      return ApiResponse.success(res, inquiry, 'Inquiry status updated successfully');
    } catch (error) {
      console.error('Update status error:', error);
      return ApiResponse.serverError(res, 'Failed to update inquiry status');
    }
  },
};

module.exports = inquiryController;
