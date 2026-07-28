import { Response, NextFunction } from 'express';

import { hasRoleCode } from '../../shared/utils/jwt.util';
import type { AuthRequest } from '../../shared/types/auth.types';

const SUPER_ADMIN_ROLE_CODE = 'SUPER_ADMIN';

/**
 * Restricts dashboard access to SUPER_ADMIN users after authentication.
 */
export async function requireSuperAdminRole(
  req: AuthRequest,
  res: Response,
  next: NextFunction,
): Promise<void> {
  if (!req.user) {
    res.status(401).json({
      success: false,
      message: 'Authentication required',
    });
    return;
  }

  try {
    const isSuperAdmin = await hasRoleCode(
      req.user.hostId,
      req.user.roleId,
      SUPER_ADMIN_ROLE_CODE,
    );

    if (!isSuperAdmin) {
      res.status(403).json({
        success: false,
        message: 'SUPER_ADMIN access is required',
      });
      return;
    }

    next();
  } catch (error: unknown) {
    next(error);
  }
}
