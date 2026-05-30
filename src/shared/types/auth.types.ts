import { Request } from 'express';

export interface AuthUser {
  id: number;
  email: string;
  name?: string;
}

export interface AuthRequest extends Request {
  user?: AuthUser;
  body: any;
  headers: any;
}

export interface JwtPayload {
  userId: number;
}
