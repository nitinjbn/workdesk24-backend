import { Response, NextFunction } from 'express';
import userService from '../services/user.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';

export class UserController {
  async getAllUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { page = 1, limit = 10 } = req.body;

      const result = await userService.getAllUsers({
        page: parseInt(String(page)),
        limit: parseInt(String(limit)),
      });

      res.json({
        success: true,
        message: 'Users retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getUserById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.body;

      const user = await userService.getUserById(id);

      res.json({
        success: true,
        message: 'User retrieved successfully',
        data: user,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id, email, name } = req.body;

      const user = await userService.updateUser(id, { email, name });

      res.json({
        success: true,
        message: 'User updated successfully',
        data: user,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { id } = req.body;
      const requestUserId = req.user!.id;

      await userService.deleteUser(id, requestUserId);

      res.json({
        success: true,
        message: 'User deleted successfully',
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new UserController();
