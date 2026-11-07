import { Request, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../shared/types/auth.types';
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
  getAdminSwitchHandoffCookieName,
  getAdminSwitchHandoffClearCookieOptions,
  getAdminSwitchHandoffCsrfCookieName,
  getAdminSwitchHandoffCsrfClearCookieOptions,
} from '../../../shared/utils/auth-cookie.util';

export class AdminAuthController {
  async switchUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const result = await authService.switchAdminHost(req.body?.hostId, {
        handoffToken: req.cookies?.[getAdminSwitchHandoffCookieName()],
        userId: req.authContext?.isSupportSession ? req.user?.id : undefined,
        switchSessionId: req.authContext?.switchSessionId,
        contextVersion: req.authContext?.contextVersion,
        requestIp: req.ip,
        userAgent: req.get('user-agent') || null,
      });

      res.cookie(getAdminAuthCookieName(), result.accessToken, getAdminAuthCookieOptions());
      res.cookie(getAdminRefreshCookieName(), result.refreshToken, getAdminRefreshCookieOptions());
      res.cookie(getAdminCsrfCookieName(), result.csrfToken, getAdminCsrfCookieOptions());
      res.clearCookie(getAdminSwitchHandoffCookieName(), getAdminSwitchHandoffClearCookieOptions());
      res.clearCookie(
        getAdminSwitchHandoffCsrfCookieName(),
        getAdminSwitchHandoffCsrfClearCookieOptions()
      );
      res.setHeader('Cache-Control', 'no-store');

      res.json({
        success: true,
        message: 'Host switch successful',
        data: {
          user: result.user,
          host: result.host,
          accessMode: result.accessMode,
          switchSession: result.switchSession,
          subscription: result.subscription,
          csrfToken: result.csrfToken,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password, deviceDetails, hostId } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        } as ApiResponse);
        return;
      }

      const result = await authService.adminLogin({ email, password, deviceDetails, hostId });
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
          subscription: result.subscription,
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
          subscription: result.subscription,
          permissions: result.permissionsByModule,
          csrfToken: result.csrfToken,
          ...(result.switchSession
            ? {
                host: result.host,
                accessMode: result.accessMode,
                switchSession: result.switchSession,
              }
            : {}),
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
      const accessCookieToken = req.cookies?.[accessCookieName] as string | undefined;
      const authorizationHeader = req.headers.authorization as string | undefined;
      const bearerToken = authorizationHeader?.startsWith('Bearer ')
        ? authorizationHeader.slice(7).trim()
        : undefined;
      const accessToken = accessCookieToken || bearerToken;

      await authService.logoutAdminSession(refreshToken, accessToken);

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

  async validateSubDomain(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { subDomain } = req.body;

      if (!subDomain) {
        res.status(400).json({
          success: false,
          message: 'subDomain is required',
        } as ApiResponse);
        return;
      }

      const subDomainDetails = await authService.getSubDomainDetails(subDomain);
      const doesExist = !!subDomainDetails?.id;

      // If the subDomain does not exist, return a 404 response
      if (!doesExist) {
        res.status(404).json({
          success: false,
          message: `SubDomain: ${subDomain} does not exists.`,
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: 'SubDomain validation successful',
        data: {
          doesExist,
          hostId: subDomainDetails?.id,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async changePassword(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { currentPassword, newPassword } = req.body || {};

      if (
        !currentPassword ||
        !newPassword ||
        typeof currentPassword !== 'string' ||
        typeof newPassword !== 'string'
      ) {
        res.status(400).json({
          success: false,
          message: 'currentPassword and newPassword are required',
        } as ApiResponse);
        return;
      }

      if (req.authContext?.isSupportSession) {
        res.status(403).json({
          success: false,
          message: 'Password change is not available in a support session',
        } as ApiResponse);
        return;
      }

      const userId = req.user?.id;
      if (!userId) {
        res.status(401).json({
          success: false,
          message: 'Authentication required',
        } as ApiResponse);
        return;
      }

      const sessionTokens = await authService.changePassword({
        userId,
        currentPassword,
        newPassword,
        currentRefreshToken: req.cookies?.[getAdminRefreshCookieName()],
      });

      if (sessionTokens) {
        res.cookie(getAdminAuthCookieName(), sessionTokens.accessToken, getAdminAuthCookieOptions());
        res.cookie(
          getAdminRefreshCookieName(),
          sessionTokens.refreshToken,
          getAdminRefreshCookieOptions()
        );
        res.cookie(getAdminCsrfCookieName(), sessionTokens.csrfToken, getAdminCsrfCookieOptions());
      }

      res.setHeader('Cache-Control', 'no-store');
      res.json({
        success: true,
        message: 'Password changed successfully',
        data: sessionTokens ? { csrfToken: sessionTokens.csrfToken } : null,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new AdminAuthController();
