import { Request } from 'express';

export interface AuthUser {
  id: number;
  hostId: number;
  email: string;
  name?: string;
  roleId: number;
  isFieldAppUser?: number;
  isAdminUser?: number;
  isSuperAdmin?: number;
}

export interface AuthContext {
  isSupportSession?: boolean;
  switchSessionId?: string;
  originalHostId?: number;
  currentHostId?: number;
  contextVersion?: number;
  accessMode?: 'SUPPORT_FULL' | 'SUPPORT_READ_ONLY';
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  authContext?: AuthContext;
  body: any;
  headers: any;
}

export interface JwtPayload {
  userId: number;
  tokenType?: 'access' | 'refresh';
  sessionId?: string;
  switchSessionId?: string;
  contextVersion?: number;
  authContext?: 'ADMIN_SWITCH';
}
