import { Request, Response, NextFunction } from 'express';
import authService from '../../auth/services/auth.service';
import { ApiResponse } from '../../../shared/types/base.types';
import {
  getSuperAdminAuthCookieName,
  getSuperAdminAuthCookieOptions,
  getSuperAdminAuthClearCookieOptions,
  getSuperAdminRefreshCookieName,
  getSuperAdminRefreshCookieOptions,
  getSuperAdminRefreshClearCookieOptions,
  getSuperAdminCsrfCookieName,
  getSuperAdminCsrfCookieOptions,
  getSuperAdminCsrfClearCookieOptions,
} from '../../../shared/utils/auth-cookie.util';

export class SuperAdminAuthController {
  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, deviceDetails } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        } as ApiResponse);
        return;
      }

      const result = await authService.superAdminLogin({ email, password, deviceDetails });
      const accessCookieName = getSuperAdminAuthCookieName();
      const refreshCookieName = getSuperAdminRefreshCookieName();
      const csrfCookieName = getSuperAdminCsrfCookieName();

      res.cookie(accessCookieName, result.accessToken, getSuperAdminAuthCookieOptions());
      res.cookie(refreshCookieName, result.refreshToken, getSuperAdminRefreshCookieOptions());
      res.cookie(csrfCookieName, result.csrfToken, getSuperAdminCsrfCookieOptions());
      res.setHeader('Cache-Control', 'no-store');

      res.json({
        success: true,
        message: 'Super Admin login successful',
        data: {
          user: result.user,
          csrfToken: result.csrfToken,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshCookieName = getSuperAdminRefreshCookieName();
      const refreshToken = req.cookies?.[refreshCookieName] as string | undefined;

      if (!refreshToken) {
        res.status(401).json({
          success: false,
          message: 'Refresh token is required',
        } as ApiResponse);
        return;
      }

      const result = await authService.refreshSuperAdminSession(refreshToken);
      const accessCookieName = getSuperAdminAuthCookieName();
      const csrfCookieName = getSuperAdminCsrfCookieName();

      res.cookie(accessCookieName, result.accessToken, getSuperAdminAuthCookieOptions());
      res.cookie(refreshCookieName, result.refreshToken, getSuperAdminRefreshCookieOptions());
      res.cookie(csrfCookieName, result.csrfToken, getSuperAdminCsrfCookieOptions());
      res.setHeader('Cache-Control', 'no-store');

      res.json({
        success: true,
        message: 'Super Admin session refreshed successfully',
        data: {
          user: result.user,
          csrfToken: result.csrfToken,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async logout(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const accessCookieName = getSuperAdminAuthCookieName();
      const refreshCookieName = getSuperAdminRefreshCookieName();
      const csrfCookieName = getSuperAdminCsrfCookieName();
      const refreshToken = req.cookies?.[refreshCookieName] as string | undefined;

      await authService.logoutSuperAdminSession(refreshToken);

      res.clearCookie(accessCookieName, getSuperAdminAuthClearCookieOptions());
      res.clearCookie(refreshCookieName, getSuperAdminRefreshClearCookieOptions());
      res.clearCookie(csrfCookieName, getSuperAdminCsrfClearCookieOptions());
      res.setHeader('Cache-Control', 'no-store');

      res.json({
        success: true,
        message: 'Super Admin logout successful',
        data: null,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new SuperAdminAuthController();
