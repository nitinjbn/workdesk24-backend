import jwt from 'jsonwebtoken';
import roleRepository from '../../modules/auth/repositories/role.repository';
import { CONFIG } from '../../config/constants';

const DEFAULT_JWT_EXPIRY: jwt.SignOptions['expiresIn'] = '7d';
const DEFAULT_JWT_REFRESH_EXPIRY: jwt.SignOptions['expiresIn'] = '30d';

export const getJwtSecret = (): string => {
  const secret = process.env.JWT_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_SECRET is not configured');
  }

  return secret;
};

export const getJwtExpiresIn = (): jwt.SignOptions['expiresIn'] => {
  const expiresIn = process.env.JWT_EXPIRES_IN?.trim();
  if (!expiresIn) {
    return DEFAULT_JWT_EXPIRY;
  }

  return expiresIn as jwt.SignOptions['expiresIn'];
};

export const getJwtRefreshSecret = (): string => {
  const secret = process.env.JWT_REFRESH_SECRET?.trim();
  if (!secret) {
    throw new Error('JWT_REFRESH_SECRET is not configured');
  }

  return secret;
};

export const getJwtRefreshExpiresIn = (): jwt.SignOptions['expiresIn'] => {
  const expiresIn = process.env.JWT_REFRESH_EXPIRES_IN?.trim();
  if (!expiresIn) {
    return DEFAULT_JWT_REFRESH_EXPIRY;
  }

  return expiresIn as jwt.SignOptions['expiresIn'];
};

export const hasRoleCode = async (
  hostId: number,
  roleId: number,
  roleCode: string
): Promise<boolean> => {
  return roleRepository.hasRoleCode(hostId, roleId, roleCode);
};

export const hasAnyRoleCode = async (
  hostId: number,
  roleId: number,
  roleCodes: string[]
): Promise<boolean> => {
  return roleRepository.hasAnyRoleCode(hostId, roleId, roleCodes);
};

export const isAdminRole = async (hostId: number, roleId: number): Promise<boolean> => {
  const allowedAdminPanelRoles = CONFIG.AUTH.ADMIN_PANEL.LOGIN.ALLOWED_ROLES;
  //console.log('########## Allowed Admin Panel Roles:', allowedAdminPanelRoles);
  if (allowedAdminPanelRoles && allowedAdminPanelRoles.length > 0) {
    return hasAnyRoleCode(hostId, roleId, allowedAdminPanelRoles.map((code: string) => code.trim().toUpperCase()));
  }
  return false;
};