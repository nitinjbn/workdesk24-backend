import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JwtPayload } from '../types/auth.types';
import userRepository from '../../modules/auth/repositories/user.repository';
import userRefreshTokenRepository from '../../modules/auth/repositories/user-refresh-token.repository';
import { isAdminRole, getJwtSecret } from '../utils/jwt.util';
import { getAdminAuthCookieName, getSuperAdminAuthCookieName } from '../utils/auth-cookie.util';
import adminSwitchSessionRepository from '../../modules/auth/repositories/admin-switch-session.repository';
import { getAdminSwitchHandoffCookieName } from '../utils/auth-cookie.util';
import hostService from '../../modules/master/services/host.service';

const getBearerToken = (authorizationHeader: string | undefined): string | null => {
  if (!authorizationHeader) {
    return null;
  }

  const [scheme, token] = authorizationHeader.trim().split(' ');
  if (scheme !== 'Bearer' || !token) {
    return null;
  }

  return token;
};

const forceHostId = (value: unknown, hostId: number): unknown => {
  if (Array.isArray(value)) {
    return value.map((item) => forceHostId(item, hostId));
  }
  if (!value || typeof value !== 'object') {
    return value;
  }

  const scopedValue: Record<string, unknown> = {};
  for (const [key, nestedValue] of Object.entries(value)) {
    scopedValue[key] = key === 'hostId' ? hostId : forceHostId(nestedValue, hostId);
  }
  return scopedValue;
};

const enforceSupportHostScope = (req: AuthRequest, hostId: number): void => {
  const scopedBody = forceHostId(req.body || {}, hostId);
  if (scopedBody && typeof scopedBody === 'object' && !Array.isArray(scopedBody)) {
    (scopedBody as Record<string, unknown>).hostId = hostId;
  }
  req.body = scopedBody;
  const query = req.query as Record<string, unknown>;
  if (query && Object.prototype.hasOwnProperty.call(query, 'hostId')) {
    query.hostId = String(hostId);
  }
};

export const supportHostScopeMiddleware = (
  req: AuthRequest,
  _res: Response,
  next: NextFunction
): void => {
  const hostId = req.authContext?.currentHostId;
  if (req.authContext?.isSupportSession && Number.isSafeInteger(hostId) && Number(hostId) > 0) {
    enforceSupportHostScope(req, Number(hostId));
  }
  next();
};

export const authMiddleware = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tokenFromHeader = getBearerToken(req.headers.authorization);
    const tokenFromCookie = req.cookies?.[getAdminAuthCookieName()] as string | undefined;
    const token = tokenFromHeader || tokenFromCookie;

    if (!token) {
      res.setHeader('x-auth-error-code', 'AUTH_REQUIRED');
      res.setHeader('x-http-status-code', '401');
      res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        statusCode: 401, // This is important for the APP to handle refresh token as fallback if HTTPS status code is not 401 (There was an issue in uploadMedia, where APP was getting -1 as HTTP status code, and it was not able to handle refresh token fallback)
        message: 'Authentication required',
      });
      return;
    }

    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (decoded.tokenType !== 'access' || !decoded.userId) {
      res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        statusCode: 401,
        message: 'Invalid token',
      });
      return;
    }

    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      res.setHeader('x-auth-error-code', 'INVALID_TOKEN');
      res.setHeader('x-http-status-code', '401');
      res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        statusCode: 401, // This is important for the APP to handle refresh token as fallback if HTTPS status code is not 401 (There was an issue in uploadMedia, where APP was getting -1 as HTTP status code, and it was not able to handle refresh token fallback)
        message: 'Invalid token',
      });
      return;
    }

    if (decoded.authContext === 'ADMIN_SWITCH' || decoded.switchSessionId) {
      const requestPath = req.originalUrl || '';
      const basePath = req.baseUrl || '';
      if (
        !requestPath.startsWith('/api/v1/admin/') &&
        !basePath.startsWith('/api/v1/admin')
      ) {
        res.status(401).json({
          success: false,
          code: 'INVALID_TOKEN',
          statusCode: 401,
          message: 'Invalid token',
        });
        return;
      }

      const session = decoded.switchSessionId
        ? await adminSwitchSessionRepository.findBySwitchSessionId(decoded.switchSessionId)
        : null;

      if (
        !session ||
        session.userId !== user.id ||
        session.contextVersion !== decoded.contextVersion ||
        user.isSuperAdmin !== 1 ||
        user.accountStatus !== 'ACTIVE'
      ) {
        res.status(401).json({
          success: false,
          code: 'INVALID_SWITCH_SESSION',
          statusCode: 401,
          message: 'Invalid or expired switch session',
        });
        return;
      }

      const sourceSession = await userRefreshTokenRepository.findActiveByFamily(
        session.userId,
        session.sourceTokenFamily,
        undefined,
        false
      );
      if (!sourceSession) {
        res.status(401).json({
          success: false,
          code: 'INVALID_SWITCH_SESSION',
          statusCode: 401,
          message: 'The original Super Admin session is no longer active',
        });
        return;
      }

      const hostContext = await hostService.getSwitchHostContext(session.currentHostId);
      if (!hostContext) {
        res.status(401).json({
          success: false,
          code: 'INVALID_SWITCH_SESSION',
          statusCode: 401,
          message: 'The selected host is no longer available',
        });
        return;
      }

      req.user = {
        id: user.id,
        hostId: session.currentHostId,
        email: user.email,
        name: user.name,
        roleId: user.roleId,
        isFieldAppUser: user.isFieldAppUser,
        isAdminUser: user.isAdminUser,
        isSuperAdmin: user.isSuperAdmin,
      };
      req.authContext = {
        isSupportSession: true,
        switchSessionId: session.switchSessionId,
        originalHostId: session.originalHostId,
        currentHostId: session.currentHostId,
        contextVersion: session.contextVersion,
        accessMode: hostContext.accessMode,
      };
      const supportRequestPath = (req.originalUrl || '').split('?')[0];
      if (supportRequestPath !== '/api/v1/admin/switchUser') {
        enforceSupportHostScope(req, session.currentHostId);
      }

      next();
      return;
    }

    req.user = {
      id: user.id,
      hostId: user.hostId,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      isFieldAppUser: user.isFieldAppUser,
      isAdminUser: user.isAdminUser,
      isSuperAdmin: user.isSuperAdmin,
    };

    next();
  } catch (error: unknown) {
    if (
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.NotBeforeError
    ) {
      res.setHeader('x-auth-error-code', 'INVALID_OR_EXPIRED_TOKEN');
      res.setHeader('x-http-status-code', '401');
      res.status(401).json({
        success: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        statusCode: 401,
        message: 'Invalid or expired token',
      });
      return;
    }

    next(error);
  }
};

export const requireAdminRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.setHeader('x-auth-error-code', 'AUTH_REQUIRED');
    res.setHeader('x-http-status-code', '401');
    res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      statusCode: 401,
      message: 'Authentication required',
    });
    return;
  }

  try {
    //console.log('##################### req.user:', req.user);
    //const isAdmin = await isAdminRole(req.user.hostId, req.user.roleId);
    const isAdmin =
      req.user.isAdminUser == 1 ||
      (req.authContext?.isSupportSession === true && req.user.isSuperAdmin == 1);

    if (!isAdmin) {
      res.setHeader('x-auth-error-code', 'ADMIN_ACCESS_REQUIRED');
      res.setHeader('x-http-status-code', '403');
      res.status(403).json({
        success: false,
        code: 'ADMIN_ACCESS_REQUIRED',
        statusCode: 403,
        message: 'Admin access is required',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const requireSuperAdminRole = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (!req.user) {
    res.setHeader('x-auth-error-code', 'AUTH_REQUIRED');
    res.setHeader('x-http-status-code', '401');
    res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      statusCode: 401,
      message: 'Authentication required',
    });
    return;
  }

  try {
    //console.log('##################### req.user:', req.user);
    //const isAdmin = await isAdminRole(req.user.hostId, req.user.roleId);
    const isSuperAdmin = req.user.isSuperAdmin == 1;

    if (!isSuperAdmin) {
      res.setHeader('x-auth-error-code', 'SUPER_ADMIN_ACCESS_REQUIRED');
      res.setHeader('x-http-status-code', '403');
      res.status(403).json({
        success: false,
        code: 'SUPER_ADMIN_ACCESS_REQUIRED',
        statusCode: 403,
        message: 'Super admin access is required',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};

export const authMiddlewareSuperAdmin = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  try {
    const tokenFromHeader = getBearerToken(req.headers.authorization);
    const tokenFromCookie = req.cookies?.[getSuperAdminAuthCookieName()] as string | undefined;
    const token = tokenFromHeader || tokenFromCookie;

    if (!token) {
      res.setHeader('x-auth-error-code', 'AUTH_REQUIRED');
      res.setHeader('x-http-status-code', '401');
      res.status(401).json({
        success: false,
        code: 'AUTH_REQUIRED',
        statusCode: 401, // This is important for the APP to handle refresh token as fallback if HTTPS status code is not 401 (There was an issue in uploadMedia, where APP was getting -1 as HTTP status code, and it was not able to handle refresh token fallback)
        message: 'Authentication required',
      });
      return;
    }

    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as JwtPayload;

    if (
      decoded.tokenType !== 'access' ||
      !decoded.userId ||
      decoded.switchSessionId ||
      decoded.authContext === 'ADMIN_SWITCH'
    ) {
      res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        statusCode: 401,
        message: 'Invalid token',
      });
      return;
    }

    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      res.setHeader('x-auth-error-code', 'INVALID_TOKEN');
      res.setHeader('x-http-status-code', '401');
      res.status(401).json({
        success: false,
        code: 'INVALID_TOKEN',
        statusCode: 401, // This is important for the APP to handle refresh token as fallback if HTTPS status code is not 401 (There was an issue in uploadMedia, where APP was getting -1 as HTTP status code, and it was not able to handle refresh token fallback)
        message: 'Invalid token',
      });
      return;
    }

    req.user = {
      id: user.id,
      hostId: user.hostId,
      email: user.email,
      name: user.name,
      roleId: user.roleId,
      isFieldAppUser: user.isFieldAppUser,
      isAdminUser: user.isAdminUser,
      isSuperAdmin: user.isSuperAdmin,
    };

    next();
  } catch (error: unknown) {
    if (
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.NotBeforeError
    ) {
      res.setHeader('x-auth-error-code', 'INVALID_OR_EXPIRED_TOKEN');
      res.setHeader('x-http-status-code', '401');
      res.status(401).json({
        success: false,
        code: 'INVALID_OR_EXPIRED_TOKEN',
        statusCode: 401,
        message: 'Invalid or expired token',
      });
      return;
    }

    next(error);
  }
};

export const switchUserAuthentication = async (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): Promise<void> => {
  if (req.cookies?.[getAdminSwitchHandoffCookieName()]) {
    next();
    return;
  }

  const tokenFromHeader = getBearerToken(req.headers.authorization);
  const tokenFromCookie = req.cookies?.[getAdminAuthCookieName()] as string | undefined;
  if (!tokenFromHeader && !tokenFromCookie) {
    res.status(401).json({
      success: false,
      code: 'AUTH_REQUIRED',
      statusCode: 401,
      message: 'Authentication required',
    });
    return;
  }

  await authMiddleware(req, res, () => {
    if (!req.authContext?.isSupportSession || req.user?.isSuperAdmin !== 1) {
      res.status(403).json({
        success: false,
        code: 'SUPER_ADMIN_ACCESS_REQUIRED',
        statusCode: 403,
        message: 'An active Super Admin switch session is required',
      });
      return;
    }
    next();
  });
};
