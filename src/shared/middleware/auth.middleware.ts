import { Response, NextFunction } from 'express';
import jwt from 'jsonwebtoken';
import { AuthRequest, JwtPayload } from '../types/auth.types';
import userRepository from '../../modules/auth/repositories/user.repository';
import { isAdminRole, getJwtSecret } from '../utils/jwt.util';
import { getAdminAuthCookieName } from '../utils/auth-cookie.util';

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
      res.status(401).json({
        success: false,
        message: 'Authentication required',
      });
      return;
    }

    const secret = getJwtSecret();
    const decoded = jwt.verify(token, secret) as JwtPayload;

    const user = await userRepository.findById(decoded.userId);

    if (!user) {
      res.status(401).json({
        success: false,
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
    };

    next();
  } catch (error: unknown) {
    if (
      error instanceof jwt.TokenExpiredError ||
      error instanceof jwt.JsonWebTokenError ||
      error instanceof jwt.NotBeforeError
    ) {
      res.status(401).json({
        success: false,
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
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  try {
    const isAdmin = await isAdminRole(req.user.hostId, req.user.roleId);

    if (!isAdmin) {
      res.status(403).json({
        success: false,
        message: 'Admin access is required',
      });
      return;
    }

    next();
  } catch (error) {
    next(error);
  }
};
