import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import userRepository from '../repositories/user.repository';
import bcrypt from 'bcryptjs';
import adminRefreshTokenRepository from '../repositories/admin-refresh-token.repository';
import rolePermissionRepository, { RolePermissionAssignmentView, RolePermissionView } from '../repositories/role-permission.repository';
import userPermissionRepository, { UserPermissionAssignmentView } from '../repositories/user-permission.repository';
import {
  getJwtExpiresIn,
  getJwtRefreshExpiresIn,
  getJwtRefreshSecret,
  getJwtSecret,
  isAppLoginRole,
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
  permissionsByModule: Array<{
    moduleName: string;
    actions: RolePermissionView[];
  }>;
}

interface AdminAuthResponse {
  user: unknown;
  //permissions: RolePermissionView[];
  permissionsByModule: Array<{
    moduleName: string;
    actions: RolePermissionView[];
  }>;
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
    const permissionsByModule = await this.getPermissionsByModuleForUser(user.hostId, user.roleId, user.id);

    return {
      user: user.toJSON(),
      token,
      permissionsByModule,
    };
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    const user = await this.validateCredentials(data);
    const isAllowedAppLogin = await isAppLoginRole(user.hostId, user.roleId);
    if (!isAllowedAppLogin) {
      throw createConfiguredError('APP_LOGIN_ACCESS_DENIED', 'APP_LOGIN_ACCESS_DENIED');
    }

    const token = this.generateAccessToken(user.id);
    const permissionsByModule = await this.getPermissionsByModuleForUser(user.hostId, user.roleId, user.id);

    return {
      user: user.toJSON(),
      token,
      permissionsByModule,
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
    const permissionsByModule = await this.getPermissionsByModuleForUser(user.hostId, user.roleId, user.id);

    return {
      user: user.toJSON(),
      //permissions,
      permissionsByModule,
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
      throw createConfiguredError('INVALID_REFRESH_TOKEN', 'INVALID_REFRESH_TOKEN');
    }

    if (tokenRecord.isRevoked === 1) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
      throw createConfiguredError('REFRESH_TOKEN_REUSE_DETECTED', 'REFRESH_TOKEN_REUSE_DETECTED');
    }

    if (tokenRecord.expiresAt <= now) {
      await adminRefreshTokenRepository.revokeTokenById(tokenRecord.id);
      throw createConfiguredError('REFRESH_TOKEN_EXPIRED', 'REFRESH_TOKEN_EXPIRED');
    }

    if (tokenRecord.userId !== payload.userId || tokenRecord.tokenFamily !== payload.tokenFamily) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN', 'INVALID_REFRESH_TOKEN');
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN', 'INVALID_REFRESH_TOKEN');
    }

    if (user.isActive === 0) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ACCOUNT_INACTIVE', 'ACCOUNT_INACTIVE');
    }

    const isAdmin = await isAdminRole(user.hostId, user.roleId);
    if (!isAdmin) {
      await adminRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ADMIN_PORTAL_ACCESS_DENIED', 'ADMIN_PORTAL_ACCESS_DENIED');
    }

    const rotatedTokens = await this.createAdminSessionTokens(user.id, payload.tokenFamily);
    await adminRefreshTokenRepository.revokeTokenById(tokenRecord.id, rotatedTokens.refreshTokenHash);
    const permissionsByModule = await this.getPermissionsByModuleForUser(user.hostId, user.roleId, user.id);

    return {
      user: user.toJSON(),
      //permissions,
      permissionsByModule,
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
      throw createConfiguredError('INVALID_CREDENTIALS', 'INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw createConfiguredError('INVALID_CREDENTIALS', 'INVALID_CREDENTIALS');
    }

    if (user.isActive === 0) {
      throw createConfiguredError('ACCOUNT_INACTIVE', 'ACCOUNT_INACTIVE');
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

  private groupPermissionsByModule(
    permissions: RolePermissionView[]
  ): Array<{ moduleName: string; actions: RolePermissionView[] }> {
    const grouped = new Map<string, RolePermissionView[]>();

    permissions.forEach((permission) => {
      const existing = grouped.get(permission.moduleName) || [];
      existing.push(permission);
      grouped.set(permission.moduleName, existing);
    });

    return Array.from(grouped.entries()).map(([moduleName, modulePermissions]) => ({
      moduleName,
      actions: modulePermissions,
    }));
  }

  private async getEffectiveEnabledPermissions(
    hostId: number,
    roleId: number,
    userId: number
  ): Promise<RolePermissionView[]> {
    const [rolePermissions, userPermissions] = await Promise.all([
      rolePermissionRepository.getPermissionsByRole(hostId, roleId),
      userPermissionRepository.getPermissionsByUser(hostId, userId),
    ]);

    const permissionMap = new Map<number, RolePermissionAssignmentView>();

    rolePermissions.forEach((permission) => {
      permissionMap.set(permission.id, permission);
    });

    userPermissions.forEach((userPermission) => {
      const existing = permissionMap.get(userPermission.id);

      if (existing) {
        permissionMap.set(userPermission.id, {
          ...existing,
          isEnabled: userPermission.isEnabled,
        });
        return;
      }

      permissionMap.set(userPermission.id, this.toRolePermissionAssignmentView(userPermission));
    });

    return Array.from(permissionMap.values())
      .filter((permission) => permission.isEnabled === 1)
      .map(({ isEnabled: _isEnabled, ...permission }) => permission)
      .sort((a, b) => {
        const moduleCompare = a.moduleName.localeCompare(b.moduleName);
        if (moduleCompare !== 0) {
          return moduleCompare;
        }

        return a.permissionCode.localeCompare(b.permissionCode);
      });
  }

  private async getPermissionsByModuleForUser(
    hostId: number,
    roleId: number,
    userId: number
  ): Promise<Array<{ moduleName: string; actions: RolePermissionView[] }>> {
    const permissions = await this.getEffectiveEnabledPermissions(hostId, roleId, userId);
    return this.groupPermissionsByModule(permissions);
  }

  private toRolePermissionAssignmentView(
    permission: UserPermissionAssignmentView
  ): RolePermissionAssignmentView {
    return {
      id: permission.id,
      permissionCode: permission.permissionCode,
      permissionName: permission.permissionName,
      moduleName: permission.moduleName,
      isEnabled: permission.isEnabled,
    };
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
