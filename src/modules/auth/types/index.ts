import { BaseModel } from '../../../shared/types/base.types';

export interface UserAttributes extends BaseModel {
  email: string;
  password: string;
  name?: string;
}

export interface RegisterDto {
  email: string;
  password: string;
  name?: string;
}

export interface LoginDto {
  email: string;
  password: string;
}

export interface AuthResponse {
  user: Omit<UserAttributes, 'password'>;
  token: string;
}
