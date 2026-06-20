import { Request } from 'express';

export interface AuthUser {
  id: number;
  hostId: number;
  email: string;
  name?: string;
  roleId: number;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  body: any;
  headers: any;
}

export interface JwtPayload {
  userId: number;
}
