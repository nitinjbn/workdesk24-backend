const { User } = require('../../../models');
const ApiResponse = require('../../../utils/response');

const userController = {
  async getAllUsers(req, res) {
    try {
      const { page = 1, limit = 10 } = req.body;
      const offset = (page - 1) * limit;

      const { rows, count } = await User.findAndCountAll({
        attributes: { exclude: ['password'] },
        limit: parseInt(limit),
        offset: parseInt(offset),
        order: [['createdAt', 'DESC']],
      });

      return ApiResponse.success(res, {
        users: rows,
        pagination: {
          total: count,
          page: parseInt(page),
          limit: parseInt(limit),
          totalPages: Math.ceil(count / limit),
        },
      });
    } catch (error) {
      console.error('Get users error:', error);
      return ApiResponse.serverError(res, 'Failed to fetch users');
    }
  },

  async getUserById(req, res) {
    try {
      const { id } = req.body;

      const user = await User.findByPk(id, {
        attributes: { exclude: ['password'] },
      });

      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      return ApiResponse.success(res, user);
    } catch (error) {
      console.error('Get user error:', error);
      return ApiResponse.serverError(res, 'Failed to fetch user');
    }
  },

  async updateUser(req, res) {
    try {
      const { id, email, name } = req.body;

      const user = await User.findByPk(id);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      if (email) user.email = email;
      if (name) user.name = name;

      await user.save();

      const updatedUser = user.toJSON();
      delete updatedUser.password;

      return ApiResponse.success(res, updatedUser, 'User updated successfully');
    } catch (error) {
      console.error('Update user error:', error);
      return ApiResponse.serverError(res, 'Failed to update user');
    }
  },

  async deleteUser(req, res) {
    try {
      const { id } = req.body;

      if (parseInt(id) === req.user.id) {
        return ApiResponse.badRequest(res, 'Cannot delete your own account');
      }

      const user = await User.findByPk(id);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      await user.destroy();

      return ApiResponse.success(res, null, 'User deleted successfully');
    } catch (error) {
      console.error('Delete user error:', error);
      return ApiResponse.serverError(res, 'Failed to delete user');
    }
  },
};

module.exports = userController;
