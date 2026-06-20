import { Request, Response, NextFunction } from 'express';
import authService from '../../auth/services/auth.service';
import { ApiResponse } from '../../../shared/types/base.types';
import {
  getAdminAuthCookieName,
  getAdminAuthCookieOptions,
  getAdminAuthClearCookieOptions,
  getAdminRefreshCookieName,
  getAdminRefreshCookieOptions,
  getAdminRefreshClearCookieOptions,
  getAdminCsrfCookieName,
  getAdminCsrfCookieOptions,
  getAdminCsrfClearCookieOptions,
} from '../../../shared/utils/auth-cookie.util';

export class AdminAuthController {
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

      const result = await authService.adminLogin({ email, password });
      const accessCookieName = getAdminAuthCookieName();
      const refreshCookieName = getAdminRefreshCookieName();
      const csrfCookieName = getAdminCsrfCookieName();

      res.cookie(accessCookieName, result.accessToken, getAdminAuthCookieOptions());
      res.cookie(refreshCookieName, result.refreshToken, getAdminRefreshCookieOptions());
      res.cookie(csrfCookieName, result.csrfToken, getAdminCsrfCookieOptions());
      res.setHeader('Cache-Control', 'no-store');

      res.json({
        success: true,
        message: 'Admin login successful',
        data: {
          user: result.user,
          //permissions: result.permissions,
          permissions: result.permissionsByModule,
          csrfToken: result.csrfToken,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshCookieName = getAdminRefreshCookieName();
      const refreshToken = req.cookies?.[refreshCookieName] as string | undefined;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token is required',
        } as ApiResponse);
        return;
      }

      const result = await authService.refreshAdminSession(refreshToken);
      const accessCookieName = getAdminAuthCookieName();
      const csrfCookieName = getAdminCsrfCookieName();

      res.cookie(accessCookieName, result.accessToken, getAdminAuthCookieOptions());
      res.cookie(refreshCookieName, result.refreshToken, getAdminRefreshCookieOptions());
      res.cookie(csrfCookieName, result.csrfToken, getAdminCsrfCookieOptions());
      res.setHeader('Cache-Control', 'no-store');

      res.json({
        success: true,
        message: 'Admin session refreshed successfully',
        data: {
          user: result.user,
          //permissions: result.permissions,
          permissions: result.permissionsByModule,
          csrfToken: result.csrfToken,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accessCookieName = getAdminAuthCookieName();
      const refreshCookieName = getAdminRefreshCookieName();
      const csrfCookieName = getAdminCsrfCookieName();
      const refreshToken = req.cookies?.[refreshCookieName] as string | undefined;

      await authService.logoutAdminSession(refreshToken);

      res.clearCookie(accessCookieName, getAdminAuthClearCookieOptions());
      res.clearCookie(refreshCookieName, getAdminRefreshClearCookieOptions());
      res.clearCookie(csrfCookieName, getAdminCsrfClearCookieOptions());
      res.setHeader('Cache-Control', 'no-store');

      res.json({
        success: true,
        message: 'Admin logout successful',
        data: null,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminAuthController();
