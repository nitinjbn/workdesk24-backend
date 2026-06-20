import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import userRepository from '../repositories/user.repository';
import bcrypt from 'bcryptjs';
import adminRefreshTokenRepository from '../repositories/admin-refresh-token.repository';
import {
  getJwtExpiresIn,
  getJwtRefreshExpiresIn,
  getJwtRefreshSecret,
  getJwtSecret,
  isAdminRole,
} from '../../../shared/utils/jwt.util';
import { createConfiguredError } from '../../../shared/utils/error.util';

interface RegisterDto {
  hostId?: number;
  email: string;
  password: string;
  name?: string;
  roleId?: number;
  mobile?: string;
  employeeId?: string;
  reportingManagerId?: number;
  profileImageUrl?: string;
  joiningDate?: number;
}

interface LoginDto {
  email: string;
  password: string;
}

interface AuthResponse {
  user: unknown;
  token: string;
}

interface AdminAuthResponse {
  user: unknown;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

interface RefreshTokenPayload extends jwt.JwtPayload {
  userId: number;
  tokenFamily: string;
  tokenType: 'refresh';
}

interface AdminSessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  csrfToken: string;
  tokenFamily: string;
}

type LoginUser = NonNullable<Awaited<ReturnType<typeof userRepository.findWithPassword>>>;
type AuthUser = NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>;

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponse> {
    const { hostId, email, password, name, roleId, mobile, employeeId, reportingManagerId, profileImageUrl, joiningDate } = data;

    const exists = await userRepository.existsByEmail(email);
    if (exists) {
      throw new Error('Email already registered');
    }

    const user = await userRepository.create({
      hostId,
      email,
      password,
      name,
      roleId,
      mobile,
      employeeId,
      reportingManagerId,
      profileImageUrl,
      joiningDate,
    } as any);

    const token = this.generateAccessToken(user.id);

    return {
      user: user.toJSON(),
      token,
    };
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    const user = await this.validateCredentials(data);
    const token = this.generateAccessToken(user.id);

    return {
      user: user.toJSON(),
      token,
    };
  }

  async adminLogin(data: LoginDto): Promise<AdminAuthResponse> {
    const user = await this.validateCredentials(data);
    //console.log("#################### user:", user);

    const isAdmin = await isAdminRole(user.hostId, user.roleId);
    if (!isAdmin) {
      throw createConfiguredError('ADMIN_PORTAL_ACCESS_DENIED', 'ADMIN_PORTAL_ACCESS_DENIED');
    }

    const sessionTokens = await this.createAdminSessionTokens(user.id);

    return {
      user: user.toJSON(),
      accessToken: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      csrfToken: sessionTokens.csrfToken,
    };
  }

  async refreshAdminSession(refreshToken: string): Promise<AdminAuthResponse> {
    const payload = this.verifyRefreshToken(refreshToken);
    const now = Math.floor(Date.now() / 1000);
    const tokenHash = this.hashToken(refreshToken);
    const tokenRecord = await adminRefreshTokenRepository.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      throw this.createHttpError('Invalid refresh token', 401);
    }

    if (tokenRecord.isRevoked === 1) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
      throw this.createHttpError('Refresh token reuse detected. Please login again.', 401);
    }

    if (tokenRecord.expiresAt <= now) {
      await adminRefreshTokenRepository.revokeTokenById(tokenRecord.id);
      throw this.createHttpError('Refresh token has expired', 401);
    }

    if (tokenRecord.userId !== payload.userId || tokenRecord.tokenFamily !== payload.tokenFamily) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
      throw this.createHttpError('Invalid refresh token', 401);
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw this.createHttpError('Invalid refresh token', 401);
    }

    if (user.isActive === 0) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw this.createHttpError('Account is inactive', 403);
    }

    const isAdmin = await isAdminRole(user.hostId, user.roleId);
    if (!isAdmin) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ADMIN_PORTAL_ACCESS_DENIED', 'ADMIN_PORTAL_ACCESS_DENIED');
    }

    const rotatedTokens = await this.createAdminSessionTokens(user.id, payload.tokenFamily);
    await adminRefreshTokenRepository.revokeTokenById(tokenRecord.id, rotatedTokens.refreshTokenHash);

    return {
      user: user.toJSON(),
      accessToken: rotatedTokens.accessToken,
      refreshToken: rotatedTokens.refreshToken,
      csrfToken: rotatedTokens.csrfToken,
    };
  }

  async logoutAdminSession(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = this.verifyRefreshToken(refreshToken);
      const tokenHash = this.hashToken(refreshToken);
      const tokenRecord = await adminRefreshTokenRepository.findByTokenHash(tokenHash);

      if (!tokenRecord) {
        return;
      }

      if (tokenRecord.userId !== payload.userId) {
        await adminRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
        return;
      }

      await adminRefreshTokenRepository.revokeTokenById(tokenRecord.id);
    } catch {
      return;
    }
  }

  private async validateCredentials(data: LoginDto): Promise<LoginUser> {
    const { email, password } = data;

    const user = await userRepository.findWithPassword(email);
    if (!user) {
      throw new Error('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw new Error('Invalid credentials');
    }

    if (user.isActive === 0) {
      throw new Error('Account is inactive');
    }

    return user;
  }

  private generateAccessToken(userId: number): string {
    const secret = getJwtSecret();
    const expiresIn = getJwtExpiresIn();

    return jwt.sign({ userId, tokenType: 'access' }, secret, { expiresIn });
  }

  private async createAdminSessionTokens(userId: number, tokenFamily?: string): Promise<AdminSessionTokens> {
    const refreshSecret = getJwtRefreshSecret();
    const refreshExpiresIn = getJwtRefreshExpiresIn();
    const finalTokenFamily = tokenFamily || crypto.randomBytes(16).toString('hex');
    const refreshToken = jwt.sign(
      {
        userId,
        tokenFamily: finalTokenFamily,
        tokenType: 'refresh',
      },
      refreshSecret,
      { expiresIn: refreshExpiresIn }
    );

    const decodedRefreshToken = jwt.decode(refreshToken) as jwt.JwtPayload | null;
    if (!decodedRefreshToken?.exp) {
      throw this.createHttpError('Failed to create refresh token', 500);
    }

    const refreshTokenHash = this.hashToken(refreshToken);

    await adminRefreshTokenRepository.create({
      userId,
      tokenHash: refreshTokenHash,
      tokenFamily: finalTokenFamily,
      expiresAt: decodedRefreshToken.exp,
    });

    return {
      accessToken: this.generateAccessToken(userId),
      refreshToken,
      refreshTokenHash,
      tokenFamily: finalTokenFamily,
      csrfToken: this.createCsrfToken(),
    };
  }

  private verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const secret = getJwtRefreshSecret();
      const decoded = jwt.verify(token, secret) as RefreshTokenPayload;

      if (decoded.tokenType !== 'refresh' || !decoded.userId || !decoded.tokenFamily) {
        throw this.createHttpError('Invalid refresh token', 401);
      }

      return decoded;
    } catch (error: unknown) {
      if (
        error instanceof jwt.TokenExpiredError ||
        error instanceof jwt.JsonWebTokenError ||
        error instanceof jwt.NotBeforeError
      ) {
        throw this.createHttpError('Invalid or expired refresh token', 401);
      }

      throw error;
    }
  }

  private createCsrfToken(): string {
    return crypto.randomBytes(24).toString('hex');
  }

  private hashToken(token: string): string {
    return crypto.createHash('sha256').update(token).digest('hex');
  }

  private createHttpError(message: string, statusCode: number): Error & { statusCode: number } {
    const error = new Error(message) as Error & { statusCode: number };
    error.statusCode = statusCode;
    return error;
  }

  verifyToken(token: string): { userId: number } {
    const secret = getJwtSecret();
    return jwt.verify(token, secret) as { userId: number };
  }
}

export default new AuthService();
