const { User } = require('../../../models');
const bcrypt = require('bcryptjs');
const ApiResponse = require('../../../utils/response');

const profileController = {
  async getProfile(req, res) {
    try {
      const user = await User.findByPk(req.user.id, {
        attributes: { exclude: ['password'] },
      });

      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      return ApiResponse.success(res, user);
    } catch (error) {
      console.error('Get profile error:', error);
      return ApiResponse.serverError(res, 'Failed to fetch profile');
    }
  },

  async updateProfile(req, res) {
    try {
      const { name, email } = req.body;

      const user = await User.findByPk(req.user.id);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      if (email && email !== user.email) {
        const existingUser = await User.findOne({ where: { email } });
        if (existingUser) {
          return ApiResponse.conflict(res, 'Email already in use');
        }
        user.email = email;
      }

      if (name) user.name = name;

      await user.save();

      const updatedUser = user.toJSON();
      delete updatedUser.password;

      return ApiResponse.success(res, updatedUser, 'Profile updated successfully');
    } catch (error) {
      console.error('Update profile error:', error);
      return ApiResponse.serverError(res, 'Failed to update profile');
    }
  },

  async changePassword(req, res) {
    try {
      const { currentPassword, newPassword } = req.body;

      if (!currentPassword || !newPassword) {
        return ApiResponse.badRequest(res, 'Current and new passwords are required');
      }

      if (newPassword.length < 6) {
        return ApiResponse.badRequest(res, 'New password must be at least 6 characters');
      }

      const user = await User.findByPk(req.user.id);
      if (!user) {
        return ApiResponse.notFound(res, 'User not found');
      }

      const isPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isPasswordValid) {
        return ApiResponse.unauthorized(res, 'Current password is incorrect');
      }

      user.password = await bcrypt.hash(newPassword, 10);
      await user.save();

      return ApiResponse.success(res, null, 'Password changed successfully');
    } catch (error) {
      console.error('Change password error:', error);
      return ApiResponse.serverError(res, 'Failed to change password');
    }
  },
};

module.exports = profileController;
