import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { ApiResponse } from '../../../shared/types/base.types';

export class AuthController {
  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, email, password, name, roleId, mobile, employeeId, reportingManagerId, profileImageUrl, joiningDate } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        } as ApiResponse);
        return;
      }

      const result = await authService.register({ hostId, email, password, name, roleId, mobile, employeeId, reportingManagerId, profileImageUrl, joiningDate });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        } as ApiResponse);
        return;
      }

      const result = await authService.login({ email, password });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          token: result.token,
          permissions: result.permissionsByModule,
        },
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }
}

export default new AuthController();
