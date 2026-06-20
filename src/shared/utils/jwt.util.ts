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

const hasAllowedRouteRole = async (
  hostId: number,
  roleId: number,
  allowedRoleCodes: string[]
): Promise<boolean> => {
  if (!allowedRoleCodes || allowedRoleCodes.length === 0) {
    return false;
  }

  const normalizedRoleCodes = allowedRoleCodes
    .map((code: string) => code.trim().toUpperCase())
    .filter((code: string) => code.length > 0);

  if (normalizedRoleCodes.length === 0) {
    return false;
  }

  return hasAnyRoleCode(hostId, roleId, normalizedRoleCodes);
};

export const isAppLoginRole = async (hostId: number, roleId: number): Promise<boolean> => {
  const allowedAppLoginRoles = CONFIG.AUTH.APP.LOGIN.ALLOWED_ROLES;
  return hasAllowedRouteRole(hostId, roleId, allowedAppLoginRoles);
};

export const isAdminRole = async (hostId: number, roleId: number): Promise<boolean> => {
  const allowedAdminPanelRoles = CONFIG.AUTH.ADMIN_PANEL.LOGIN.ALLOWED_ROLES;
  return hasAllowedRouteRole(hostId, roleId, allowedAdminPanelRoles);
};