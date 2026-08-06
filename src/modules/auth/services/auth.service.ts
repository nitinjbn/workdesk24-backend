import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import userRepository from '../repositories/user.repository';
import bcrypt from 'bcryptjs';
import userRefreshTokenRepository from '../repositories/user-refresh-token.repository';
import rolePermissionRepository, { RolePermissionAssignmentView, RolePermissionView } from '../repositories/role-permission.repository';
import userPermissionRepository, { UserPermissionAssignmentView } from '../repositories/user-permission.repository';
import { UserSettings } from '../../../models';
import {
  getJwtExpiresIn,
  getJwtRefreshExpiresIn,
  getJwtRefreshSecret,
  getJwtSecret,
  isAppLoginRole,
  isAdminRole,
} from '../../../shared/utils/jwt.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { CommonUtil } from '../../../shared/utils/common.util';
import { CONFIG } from '../../../config/constants';
import { DateTimeFormatUtil, formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { formatStorageFieldsByConfig } from '../../../shared/utils/storage-format.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';

interface RegisterDto {
  hostId?: number;
  email: string;
  password: string;
  name?: string;
  roleId?: number;
  designationId?: number;
  mobile?: string;
  employeeCode?: string;
  reportingManagerId?: number;
  profileImageUrl?: string;
  joiningDate?: number;
}

interface LoginDto {
  email: string;
  password: string;
  deviceDetails?: {
    deviceId: string;
  };
}

interface VerifyOtpDto {
  identifier: string;
  otpCode: string;
  deviceDetails?: {
    deviceId: string;
    deviceName: string;
    deviceModel: string;
    manufacturer: string;
    brand: string;
    device: string;
    product: string;
    hardware?: string | null;
    osVersion: string;
    sdkInt: number;
    appVersion?: string | null;
    storageTotalBytes?: number | null;
    storageAvailableBytes?: number | null;
    storageUsedBytes?: number | null;
  }
}

interface AuthResponse {
  user: unknown;
  accessToken: string;
  refreshToken: string;
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
    const { hostId, email, password, name, roleId, designationId, mobile, employeeCode, reportingManagerId, profileImageUrl, joiningDate } = data;

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
      designationId,
      mobile,
      employeeCode,
      reportingManagerId,
      profileImageUrl,
      joiningDate,
    } as any);

    return this.buildAppLoginResponse(user as unknown as LoginUser);
  }

  async login(data: LoginDto): Promise<AuthResponse> {
    const user = await this.validateCredentials(data);
    return this.buildAppLoginResponse(user);
  }

  async verifyOtp(payload: VerifyOtpDto): Promise<AuthResponse> {
    const identifier = payload.identifier?.trim();
    const otpCode = payload.otpCode?.trim();

    if (!identifier || !otpCode) {
      throw createConfiguredError('INVALID_OTP', 'Identifier and OTP are required', 400, 'VALIDATION_ERROR');
    }

    const user = await this.getUserByIdentifier({ identifier });
    //console.log("################ AuthService.verifyOtp: User found:", user);
    if (user.accountStatus != 'ACTIVE') {
      throw createConfiguredError('ACCOUNT_INACTIVE', 'User account is inactive', 403, 'ACCOUNT_INACTIVE');
    }

    const otpEntry = await userRepository.findLatestOtpByIdentifier({
      hostId: user.hostId,
      userId: user.id,
      purpose: CONFIG.OTP.AUTH.PURPOSE_KEY,
    });
    //console.log("################ AuthService.verifyOtp: OTP entry found:", otpEntry);

    if (!otpEntry) {
      throw createConfiguredError('INVALID_OTP', 'Invalid or expired OTP', 400, 'INVALID_OTP');
    }

    await userRepository.incrementOtpAttempt(Number(otpEntry.id));
    await otpEntry.reload();

    const now = Math.floor(Date.now() / 1000);

    if (otpEntry.status === 'VERIFIED') {
      throw createConfiguredError('INVALID_OTP', 'OTP is already verified', 400, 'OTP_ALREADY_VERIFIED');
    }

    if (otpEntry.expiresAt < now || otpEntry.status === 'EXPIRED') {
      await userRepository.updateOtpStatus({ otpId: Number(otpEntry.id), status: 'EXPIRED' });
      throw createConfiguredError('INVALID_OTP', 'OTP has expired', 400, 'OTP_EXPIRED');
    }

    if (otpEntry.attemptCount > otpEntry.maxAttempts) {
      await userRepository.updateOtpStatus({ otpId: Number(otpEntry.id), status: 'EXPIRED' });
      throw createConfiguredError('INVALID_OTP', 'Maximum OTP attempts exceeded', 429, 'OTP_MAX_ATTEMPTS_EXCEEDED');
    }

    const isOtpValid = await otpEntry.compareOtp(otpCode);
    if (!isOtpValid) {
      if (otpEntry.attemptCount >= otpEntry.maxAttempts) {
        await userRepository.updateOtpStatus({ otpId: Number(otpEntry.id), status: 'EXPIRED' });
      }
      throw createConfiguredError('INVALID_OTP', 'Invalid OTP', 400, 'INVALID_OTP');
    }

    await userRepository.updateOtpStatus({
      otpId: Number(otpEntry.id),
      status: 'VERIFIED',
      verifiedAt: now,
    });

    const loginUser = await userRepository.findById(user.id);
    if (!loginUser) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404, 'NOT_FOUND');
    }
    
    // Update user device details
    if(payload.deviceDetails) {
      await userRepository.updateUserDeviceDetails({
        hostId: user.hostId,
        userId: user.id,
        ...payload.deviceDetails,
      });
    }

    return this.buildAppLoginResponse(loginUser as unknown as LoginUser, payload.deviceDetails);
  }

  async updateUserDeviceDetails(payload: {
    hostId: number;
    userId: number;
    deviceId: string;
    deviceName?: string;
    deviceModel?: string;
    manufacturer?: string;
    brand?: string;
    device?: string;
    product?: string;
    hardware?: string | null;
    osVersion?: string;
    sdkInt?: number;
    appVersion?: string | null;
    storageTotalBytes?: number | null;
    storageAvailableBytes?: number | null;
    storageUsedBytes?: number | null;
    fcmToken?: string | null;
    createdAt?: number;
  }): Promise<void> {
    await userRepository.updateUserDeviceDetails(payload);
  }

  private async buildAppLoginResponse(user: any, deviceDetails?: any): Promise<AuthResponse> {
    // Try to get plain object if method exists, otherwise use as-is
    user = (user?.get ? user.get({ plain: true }) : user) as unknown as LoginUser;
    const isAllowedAppLogin = await isAppLoginRole(user.hostId, user.roleId);
    if (!isAllowedAppLogin) {
      throw createConfiguredError('APP_LOGIN_ACCESS_DENIED');
    }

    const resolvedDeviceId = await this.resolveUserDeviceId(user.hostId, user.id, deviceDetails?.deviceId);
    const sessionTokens = await this.createUserSessionTokens({ hostId: user.hostId, userId: user.id, deviceType: 'ANDROID', deviceId: resolvedDeviceId });
    const permissionsByModule = await this.getPermissionsByModuleForUser(user.hostId, user.roleId, user.id);
    
    // Fetch user settings separately since they're in a different table
    const userSettings = await UserSettings.findAll({
      where: { userId: user.id, isDeleted: 0 },
      attributes: ['settingName', 'settingValue', 'isEnabled'],
      raw: true,
    });
    
    // Attach settings array to user object
    (user as any).settings = userSettings || [];
    
    // Format user data with settings, datetime, and storage fields
    const formattedUser = await this.formatUserWithSettings(user);
    
    return {
      user: formattedUser,
      accessToken: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      permissionsByModule,
    };
  }

  private async formatUserWithSettings(user: { id: number; hostId: number; toJSON: () => any }): Promise<unknown> {
    const userData = user as any;
    // Convert settings array to key-value object
    if (userData.settings && Array.isArray(userData.settings)) {
      userData.settings = CommonUtil.convertSettingsToObject(userData.settings);

      // If weeklyOffMask is present, convert it to weeklyOffDays and remove weeklyOffMask
      if (userData.settings?.weeklyOffMask) {
        userData.settings.weeklyOffDays = DateTimeFormatUtil.getWeeklyOffDays(userData.settings.weeklyOffMask);
        delete userData.settings.weeklyOffMask;
      }
    }
    return userData;
  }

  async adminLogin(data: LoginDto): Promise<AdminAuthResponse> {
    const user = await this.validateCredentials(data);
    //console.log("#################### user:", user);

    const isAdmin = await isAdminRole(user.hostId, user.roleId);
    if (!isAdmin) {
      throw createConfiguredError('ADMIN_PORTAL_ACCESS_DENIED');
    }

    const sessionTokens = await this.createUserSessionTokens({ hostId: user.hostId, userId: user.id, deviceType: 'WEB', deviceId: data.deviceDetails?.deviceId || 'default' });
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
    const tokenRecord = await userRefreshTokenRepository.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      console.log("#################### refreshAdminSession: Token record not found for hash:", tokenHash);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    if (tokenRecord.isRevoked === 1) {
      await userRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
      throw createConfiguredError('REFRESH_TOKEN_REUSE_DETECTED');
    }

    if (tokenRecord.expiresAt <= now) {
      await userRefreshTokenRepository.revokeTokenById(tokenRecord.id);
      throw createConfiguredError('REFRESH_TOKEN_EXPIRED');
    }

    if (tokenRecord.userId !== payload.userId || tokenRecord.tokenFamily !== payload.tokenFamily) {
      console.log("#################### refreshAdminSession: Token record userId or tokenFamily mismatch. Expected userId:", payload.userId, "tokenFamily:", payload.tokenFamily, "but got userId:", tokenRecord.userId, "tokenFamily:", tokenRecord.tokenFamily);
      await userRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      console.log("#################### refreshAdminSession: User not found for userId:", payload.userId);
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    if (user.accountStatus !== 'ACTIVE') {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ACCOUNT_INACTIVE');
    }

    const isAdmin = await isAdminRole(user.hostId, user.roleId);
    if (!isAdmin) {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ADMIN_PORTAL_ACCESS_DENIED');
    }

    const resolvedDeviceId = await this.resolveUserDeviceId(user.hostId, user.id, tokenRecord.deviceId);
    const rotatedTokens = await this.createUserSessionTokens({ hostId: user.hostId, userId: user.id, tokenFamily: payload.tokenFamily, deviceType: 'WEB', deviceId: resolvedDeviceId });
    await userRefreshTokenRepository.revokeTokenById(tokenRecord.id, rotatedTokens.refreshTokenHash);
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
      const tokenRecord = await userRefreshTokenRepository.findByTokenHash(tokenHash);

      if (!tokenRecord) {
        return;
      }

      if (tokenRecord.userId !== payload.userId) {
        await userRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
        return;
      }

      await userRefreshTokenRepository.revokeTokenById(tokenRecord.id);
    } catch {
      return;
    }
  }

  async refreshAppSession(refreshToken: string): Promise<AuthResponse> {
    const payload = this.verifyRefreshToken(refreshToken);
    const now = Math.floor(Date.now() / 1000);
    const tokenHash = this.hashToken(refreshToken);
    const tokenRecord = await userRefreshTokenRepository.findByTokenHash(tokenHash);

    if (!tokenRecord) {
      console.log("#################### refreshAppSession: Token record not found for hash:", tokenHash);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    if (tokenRecord.isRevoked === 1) {
      console.log("#################### refreshAppSession: Token record is revoked for userId:", tokenRecord.userId);
      await userRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
      throw createConfiguredError('REFRESH_TOKEN_REUSE_DETECTED');
    }

    if (tokenRecord.expiresAt <= now) {
      console.log("#################### refreshAppSession: Token record is expired for userId:", tokenRecord.userId, "expiresAt:", tokenRecord.expiresAt, "now:", now);
      await userRefreshTokenRepository.revokeTokenById(tokenRecord.id);
      throw createConfiguredError('REFRESH_TOKEN_EXPIRED');
    }

    if (tokenRecord.userId !== payload.userId || tokenRecord.tokenFamily !== payload.tokenFamily) {
      console.log("#################### refreshAppSession: Token record userId or tokenFamily mismatch. Expected userId:", payload.userId, "tokenFamily:", payload.tokenFamily, "but got userId:", tokenRecord.userId, "tokenFamily:", tokenRecord.tokenFamily);
      await userRefreshTokenRepository.revokeAllActiveForUser(tokenRecord.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    let user = await userRepository.findById(payload.userId);
    user = (user?.get ? user.get({ plain: true }) : user) as unknown as LoginUser;
    if (!user) {
      console.log("#################### refreshAppSession: User not found for userId:", payload.userId);
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    if (user.accountStatus !== 'ACTIVE') {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ACCOUNT_INACTIVE');
    }

    const isAllowedAppLogin = await isAppLoginRole(user.hostId, user.roleId);
    if (!isAllowedAppLogin) {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('APP_LOGIN_ACCESS_DENIED');
    }

    const resolvedDeviceId = await this.resolveUserDeviceId(user.hostId, user.id, tokenRecord.deviceId);
    const rotatedTokens = await this.createUserSessionTokens({ hostId: user.hostId, userId: user.id, tokenFamily: payload.tokenFamily, deviceType: 'ANDROID', deviceId: resolvedDeviceId });
    await userRefreshTokenRepository.revokeTokenById(tokenRecord.id, rotatedTokens.refreshTokenHash);
    const permissionsByModule = await this.getPermissionsByModuleForUser(user.hostId, user.roleId, user.id);
    
    // Fetch user settings separately since they're in a different table
    const userSettings = await UserSettings.findAll({
      where: { userId: user.id, isDeleted: 0 },
      attributes: ['settingName', 'settingValue', 'isEnabled'],
      raw: true,
    });
    
    // Attach settings array to user object
    (user as any).settings = userSettings || [];
    
    // Format user data with settings, datetime, and storage fields
    const formattedUser = await this.formatUserWithSettings(user);

    return {
      user: formattedUser,
      accessToken: rotatedTokens.accessToken,
      refreshToken: rotatedTokens.refreshToken,
      permissionsByModule,
    };
  }

  private async validateCredentials(data: LoginDto): Promise<LoginUser> {
    const { email, password } = data;

    const user = await userRepository.findWithPassword(email);
    if (!user) {
      throw createConfiguredError('INVALID_CREDENTIALS');
    }

    const isValid = await bcrypt.compare(password, user.password);
    if (!isValid) {
      throw createConfiguredError('INVALID_CREDENTIALS');
    }

    if (user.accountStatus != 'ACTIVE') {
      throw createConfiguredError('ACCOUNT_INACTIVE');
    }

    return user;
  }

  private generateAccessToken(userId: number, deviceType: 'WEB' | 'ANDROID' | 'IOS' = 'WEB'): string {
    const secret = getJwtSecret();
    const expiresIn = getJwtExpiresIn(deviceType);

    return jwt.sign({ userId, tokenType: 'access' }, secret, { expiresIn });
  }

  private async createUserSessionTokens(payload:{hostId: number, userId: number, tokenFamily?: string, deviceType?: 'WEB' | 'ANDROID' | 'IOS', deviceId: string, deviceName?: string | null, appVersion?: string | null, lastUsedAt?: number | null }): Promise<AdminSessionTokens> {
    const refreshSecret = getJwtRefreshSecret();
    const refreshExpiresIn = getJwtRefreshExpiresIn(payload.deviceType);
    const { hostId, userId, tokenFamily } = payload;
    const finalTokenFamily = tokenFamily || crypto.randomBytes(16).toString('hex');
    
    // Revoke any existing refresh token for this device before creating a new one
    await userRefreshTokenRepository.revokeTokenByDevice(hostId, userId, payload.deviceId);
    
    const refreshToken = jwt.sign(
      {
        hostId,
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

    await userRefreshTokenRepository.create({
      hostId,
      userId,
      tokenHash: refreshTokenHash,
      tokenFamily: finalTokenFamily,
      deviceType: payload.deviceType || 'WEB',
      deviceId: payload.deviceId,
      deviceName: payload.deviceName || null,
      appVersion: payload.appVersion || null,
      lastUsedAt: payload.lastUsedAt || null,
      expiresAt: decodedRefreshToken.exp,
    });

    return {
      accessToken: this.generateAccessToken(userId, payload.deviceType || 'WEB'),
      refreshToken,
      refreshTokenHash,
      tokenFamily: finalTokenFamily,
      csrfToken: this.createCsrfToken(),
    };
  }

  private async resolveUserDeviceId(hostId: number, userId: number, preferredDeviceId?: string | null): Promise<string> {
    const trimmedPreferredDeviceId = preferredDeviceId?.trim();
    if (trimmedPreferredDeviceId) {
      return trimmedPreferredDeviceId;
    }

    const persistedDeviceId = await userRepository.getLatestDeviceIdByUser(hostId, userId);
    if (persistedDeviceId) {
      return persistedDeviceId;
    }

    throw createConfiguredError('INVALID_DEVICE_DETAILS', 'Device ID is required for app session', 400, 'VALIDATION_ERROR');
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

  async getUsersByFilter(filter: any): Promise<any> {
    if (!filter || typeof filter !== 'object') {
      throw createConfiguredError('INVALID_FILTER', 'Filter must be a valid object', 400, 'VALIDATION_ERROR');
    }
    const users = await userRepository.getUsersByFilter(filter);
    return {
      users: users,
    };
  }

  async saveOtpForUser(payload: { hostId: number, userId: number; identifierType: string; identifierValue: string; otpCode: string; expiresAt: number; purpose: string; messageId?: string; maxAttempts: number; requestIp: string; createdAt: number; otpDeliveries: Array<{ deliveryChannel: string; destination: string; messageId?: string; provider?: string; status?: string | null; failedReason?: string | null }> }): Promise<void> {
    const { userId } = payload;
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404, 'NOT_FOUND');
    }
    return await userRepository.saveOtpForUser(payload);
  }

  async getUserByIdentifier(payload: { identifier: string, deviceId?: string }): Promise<any> {
    let { identifier, deviceId } = payload;
    identifier = identifier?.trim(); // Trim whitespace from the identifier
    
    // Validate the identifier exists and is not empty
    if (!identifier) {
      throw createConfiguredError('INVALID_IDENTIFIER', 'Please enter email or mobile number.', 400, 'VALIDATION_ERROR');
    }
    
    // Determine if the identifier is an email or mobile number
    const parseIdentifierResult = CommonUtil.parseIdentifier(identifier);
    if (!parseIdentifierResult.type) {
      throw createConfiguredError('INVALID_IDENTIFIER', 'Invalid value. Must be a valid email or phone number.', 400, 'VALIDATION_ERROR');
    }

    let whereClause: Record<string, any> = {
      accountStatus: 'ACTIVE',
      deviceId: deviceId || null, // Include deviceId in the filter if provided
      isDeleted: 0
    };

    if (parseIdentifierResult.type === 'EMAIL') {
      whereClause.email = parseIdentifierResult.email;
    } else if (parseIdentifierResult.type === 'MOBILE') {
      whereClause.mobile = parseIdentifierResult.mobile;
    }

    const getUsersResult = await this.getUsersByFilter(whereClause);
    //console.log("################ AuthController.requestOtp: Users fetched by filter:", getUsersResult);
    const users = getUsersResult.users || [];

    if (!users || users.length === 0) {
      throw createConfiguredError('USER_NOT_FOUND', 'You are not registered. Please contact your administrator.', 404, 'NOT_FOUND');
    }

    if(users.length > 1) {
      throw createConfiguredError('MULTIPLE_USERS_FOUND', 'Multiple users found with the same identifier. Please contact your administrator.', 400, 'VALIDATION_ERROR');
    }

    const user = users[0];
    return user;
  }
}

export default new AuthService();
