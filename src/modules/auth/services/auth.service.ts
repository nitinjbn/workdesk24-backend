import jwt from 'jsonwebtoken';
import crypto from 'crypto';
import userRepository from '../repositories/user.repository';
import bcrypt from 'bcryptjs';
import userRefreshTokenRepository from '../repositories/user-refresh-token.repository';
import rolePermissionRepository, {
  RolePermissionAssignmentView,
  RolePermissionView,
} from '../repositories/role-permission.repository';
import userPermissionRepository, {
  UserPermissionAssignmentView,
} from '../repositories/user-permission.repository';
import roleRepository from '../repositories/role.repository';
import { sequelize, UserSettings } from '../../../models';
import adminSwitchSessionRepository from '../repositories/admin-switch-session.repository';
import adminSwitchHandoffRepository from '../repositories/admin-switch-handoff.repository';
import adminHostSwitchAuditRepository from '../repositories/admin-host-switch-audit.repository';
import { Transaction } from 'sequelize';
import {
  getJwtExpiresIn,
  getJwtRefreshExpiresIn,
  getJwtRefreshSecret,
  getJwtSecret,
  isAppLoginRole,
  isAdminRole,
} from '../../../shared/utils/jwt.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { validatePasswordPattern } from '../../../shared/utils/password.util';
import { CommonUtil } from '../../../shared/utils/common.util';
import { CONFIG } from '../../../config/constants';
import {
  DateTimeFormatUtil,
  formatDateTimeFieldsBySettings,
} from '../../../shared/utils/date-time-format.util';
import { formatStorageFieldsByConfig } from '../../../shared/utils/storage-format.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import hostService from '../../master/services/host.service';
import { JwtPayload } from '../../../shared/types/auth.types';

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

interface HostSpecificLoginDto {
  email: string;
  password: string;
  hostId: number;
  deviceDetails?: {
    deviceId: string;
  };
}

interface ChangePasswordDto {
  userId: number;
  currentPassword: string;
  newPassword: string;
  currentRefreshToken?: string;
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
  };
}

interface AuthResponse {
  user: unknown;
  subscription: {
    status: string;
    canUseApp: boolean;
    isReadOnly: boolean;
    canRenew: boolean;
    message: string;
  };
  accessToken: string;
  refreshToken: string;
  permissionsByModule: Array<{
    moduleName: string;
    actions: RolePermissionView[];
  }>;
}

interface AdminAuthResponse {
  user: unknown;
  subscription: {
    status: string;
    canUseApp: boolean;
    isReadOnly: boolean;
    canRenew: boolean;
  };
  permissionsByModule: Array<{
    moduleName: string;
    actions: RolePermissionView[];
  }>;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
  host?: unknown;
  accessMode?: 'SUPPORT_FULL' | 'SUPPORT_READ_ONLY';
  switchSession?: { switchSessionId: string; contextVersion: number };
}

interface SuperAdminAuthResponse {
  user: unknown;
  accessToken: string;
  refreshToken: string;
  csrfToken: string;
}

interface AdminSwitchHandoffResponse {
  handoffToken: string;
  csrfToken: string;
}

interface AdminSwitchAuthResponse extends AdminAuthResponse {
  host: unknown;
  accessMode: 'SUPPORT_FULL' | 'SUPPORT_READ_ONLY';
  switchSession: { switchSessionId: string; contextVersion: number };
}

interface AdminSwitchRequestContext {
  handoffToken?: string;
  userId?: number;
  switchSessionId?: string;
  contextVersion?: number;
  requestIp?: string | null;
  userAgent?: string | null;
}

interface RefreshTokenPayload extends jwt.JwtPayload {
  userId: number;
  tokenFamily: string;
  tokenType: 'refresh';
  switchSessionId?: string;
  contextVersion?: number;
}

interface AdminSessionTokens {
  accessToken: string;
  refreshToken: string;
  refreshTokenHash: string;
  csrfToken: string;
  tokenFamily: string;
  sessionId: string;
  switchSessionId?: string;
  contextVersion?: number;
}

type LoginUser = NonNullable<Awaited<ReturnType<typeof userRepository.findWithPassword>>>;
type AuthUser = NonNullable<Awaited<ReturnType<typeof userRepository.findById>>>;

export class AuthService {
  async register(data: RegisterDto): Promise<AuthResponse> {
    const {
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
    } = data;

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
    return this.buildAppLoginResponse(user, data.deviceDetails || {}, user.password);
  }

  async verifyOtp(payload: VerifyOtpDto): Promise<AuthResponse> {
    const identifier = payload.identifier?.trim();
    const otpCode = payload.otpCode?.trim();

    if (!identifier || !otpCode) {
      throw createConfiguredError(
        'INVALID_OTP',
        'Identifier and OTP are required',
        400,
        'VALIDATION_ERROR'
      );
    }

    const user = await this.getUserByIdentifier({ identifier });
    if (user.accountStatus != 'ACTIVE') {
      throw createConfiguredError(
        'ACCOUNT_INACTIVE',
        'User account is inactive',
        403,
        'ACCOUNT_INACTIVE'
      );
    }

    const otpEntry = await userRepository.findLatestOtpByIdentifier({
      hostId: user.hostId,
      userId: user.id,
      purpose: CONFIG.OTP.AUTH.PURPOSE_KEY,
    });

    if (!otpEntry) {
      throw createConfiguredError('INVALID_OTP', 'Invalid or expired OTP', 400, 'INVALID_OTP');
    }

    await userRepository.incrementOtpAttempt(Number(otpEntry.id));
    await otpEntry.reload();

    const now = Math.floor(Date.now() / 1000);

    if (otpEntry.status === 'VERIFIED') {
      throw createConfiguredError(
        'INVALID_OTP',
        'OTP is already verified',
        400,
        'OTP_ALREADY_VERIFIED'
      );
    }

    if (otpEntry.expiresAt < now || otpEntry.status === 'EXPIRED') {
      await userRepository.updateOtpStatus({ otpId: Number(otpEntry.id), status: 'EXPIRED' });
      throw createConfiguredError('INVALID_OTP', 'OTP has expired', 400, 'OTP_EXPIRED');
    }

    if (otpEntry.attemptCount > otpEntry.maxAttempts) {
      await userRepository.updateOtpStatus({ otpId: Number(otpEntry.id), status: 'EXPIRED' });
      throw createConfiguredError(
        'INVALID_OTP',
        'Maximum OTP attempts exceeded',
        429,
        'OTP_MAX_ATTEMPTS_EXCEEDED'
      );
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

  private async buildAppLoginResponse(
    user: any,
    deviceDetails?: any,
    expectedPasswordHash?: string
  ): Promise<AuthResponse> {
    // Try to get plain object if method exists, otherwise use as-is
    user = (user?.get ? user.get({ plain: true }) : user) as unknown as LoginUser;
    //const isAllowedAppLogin = await isAppLoginRole(user.hostId, user.roleId);
    if (!user.isFieldAppUser) {
      throw createConfiguredError('APP_LOGIN_ACCESS_DENIED');
    }

    const resolvedDeviceId = await this.resolveUserDeviceId(
      user.hostId,
      user.id,
      deviceDetails?.deviceId
    );
    const sessionTokens = await this.createUserSessionTokens({
      hostId: user.hostId,
      userId: user.id,
      deviceType: 'ANDROID',
      deviceId: resolvedDeviceId,
      passwordChangedAt: user.passwordChangedAt ?? 0,
      expectedPasswordHash,
    });
    const permissionsByModule = await this.getPermissionsByModuleForUser(
      user.hostId,
      user.roleId,
      user.id
    );

    // Fetch user settings separately since they're in a different table
    const userSettings = await UserSettings.findAll({
      where: { userId: user.id, isDeleted: 0 },
      attributes: ['settingName', 'settingValue', 'isEnabled'],
      raw: true,
    });

    // Attach settings array to user object
    (user as any).settings = userSettings || [];

    // Attach active attendance locations (used for geo-fencing on attendance marking)
    (user as any).attendanceLocations = await userRepository.getAttendanceSitesForUser(user.id);

    // Format user data with settings, datetime, and storage fields
    const formattedUser = await this.formatUserWithSettings(user);

    // Fetch subscription status for the host
    const subscription = await this.getSubscriptionStatusForHost(user.hostId, 'APP');

    // Update user device details
    if (deviceDetails) {
      await userRepository.updateUserDeviceDetails({
        hostId: user.hostId,
        userId: user.id,
        ...deviceDetails,
      });

      // Unregister other devices except the current one
      await userRepository.unregisterUserOtherDevices({
        hostId: user.hostId,
        userId: user.id,
        excludeDeviceId: deviceDetails.deviceId,
      });
    }

    return {
      user: formattedUser,
      accessToken: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      permissionsByModule,
      subscription,
    };
  }

  private async formatUserWithSettings(user: {
    id: number;
    hostId: number;
    toJSON: () => any;
  }): Promise<unknown> {
    const userData = user as any;
    // Convert settings array to key-value object
    if (userData.settings && Array.isArray(userData.settings)) {
      userData.settings = CommonUtil.convertSettingsToObject(userData.settings);

      // If weeklyOffMask is present, convert it to weeklyOffDays and remove weeklyOffMask
      if (userData.settings?.weeklyOffMask) {
        userData.settings.weeklyOffDays = DateTimeFormatUtil.getWeeklyOffDays(
          userData.settings.weeklyOffMask
        );
        delete userData.settings.weeklyOffMask;
      }

      // Ensure autoDayoverEnabled is set to 1 and maxWorkingMinutes is set to 24*60 if not already configured
      if (userData.settings?.autoDayoverEnabled != 1) {
        userData.settings.autoDayoverEnabled = 1;
        userData.settings.maxWorkingMinutes = 24 * 60;
      }
    }
    return userData;
  }

  private async getSubscriptionStatusForHost(hostId: number, context: 'APP' | 'ADMIN') {
    const subscription = {
      status: 'ACTIVE',
      canUseApp: true,
      isReadOnly: false,
      canRenew: false,
      message: '',
    };
    const currentSubscription = await hostService.getCurrentSubscription(hostId);
    if (!currentSubscription || Object.keys(currentSubscription).length === 0) {
      subscription.status = 'INACTIVE';
      subscription.canUseApp = false;
      subscription.isReadOnly = true;

      if (context === 'APP') {
        subscription.message =
          'Your company subscription has expired. New activities are disabled. Please contact your administrator.';
      } else if (context === 'ADMIN') {
        subscription.canRenew = true;
        subscription.message =
          'Your WorkDesk24 subscription has expired. Your account is currently in read-only mode. Renew your subscription to restore full access.';
      }
    }
    return subscription;
  }

  async adminLogin(data: HostSpecificLoginDto): Promise<AdminAuthResponse> {
    // TODO: Call only host-specific method "validateHostSpecificCredentials", when the hostId is passed on login from UI
    const user = data.hostId
      ? await this.validateHostSpecificCredentials(data)
      : await this.validateCredentials(data);

    if (!user.isAdminUser) {
      throw createConfiguredError('ADMIN_PORTAL_ACCESS_DENIED');
    }

    // Check if the host has an active subscription, this will throw an error if not active
    const subscription = await this.getSubscriptionStatusForHost(user.hostId, 'ADMIN');

    const sessionTokens = await this.createUserSessionTokens({
      hostId: user.hostId,
      userId: user.id,
      deviceType: 'WEB',
      deviceId: data.deviceDetails?.deviceId || 'default',
      passwordChangedAt: user.passwordChangedAt ?? 0,
      expectedPasswordHash: user.password,
    });
    const permissionsByModule = await this.getPermissionsByModuleForUser(
      user.hostId,
      user.roleId,
      user.id
    );

    return {
      user: user.toJSON(),
      subscription,
      permissionsByModule,
      accessToken: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      csrfToken: sessionTokens.csrfToken,
    };
  }

  async createAdminSwitchHandoff(
    userId: number,
    refreshToken: string
  ): Promise<AdminSwitchHandoffResponse> {
    const refreshPayload = this.verifyRefreshToken(refreshToken);
    if (refreshPayload.userId !== userId || refreshPayload.switchSessionId) {
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    const refreshRecord = await userRefreshTokenRepository.findByTokenHash(
      this.hashToken(refreshToken)
    );
    if (
      !refreshRecord ||
      refreshRecord.userId !== userId ||
      refreshRecord.hostId !== refreshPayload.hostId ||
      refreshRecord.tokenFamily !== refreshPayload.tokenFamily ||
      refreshRecord.deviceType !== 'WEB' ||
      refreshRecord.isRevoked === 1 ||
      refreshRecord.expiresAt <= Math.floor(Date.now() / 1000)
    ) {
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    const user = await userRepository.findById(userId);
    if (!user || user.accountStatus !== 'ACTIVE' || user.isSuperAdmin !== 1) {
      throw createConfiguredError('SUPER_ADMIN_ACCESS_REQUIRED');
    }

    const now = Math.floor(Date.now() / 1000);
    const handoffToken = crypto.randomBytes(32).toString('hex');
    await adminSwitchHandoffRepository.create({
      tokenHash: this.hashToken(handoffToken),
      userId: user.id,
      tokenFamily: refreshPayload.tokenFamily,
      expiresAt: now + 60,
      createdAt: now,
      updatedAt: now,
    });

    return { handoffToken, csrfToken: this.createCsrfToken() };
  }

  async switchAdminHost(
    hostId: number,
    context: AdminSwitchRequestContext
  ): Promise<AdminSwitchAuthResponse> {
    if (!Number.isSafeInteger(hostId) || hostId <= 0) {
      throw createConfiguredError('INVALID_HOST_ID', 'A valid hostId is required', 400, 'VALIDATION_ERROR');
    }

    return sequelize.transaction(async (transaction) => {
      const now = Math.floor(Date.now() / 1000);
      let session: Awaited<ReturnType<typeof adminSwitchSessionRepository.findBySwitchSessionId>>;
      let user: AuthUser;
      let targetHostContext: Awaited<ReturnType<typeof hostService.getSwitchHostContext>>;
      let tokens: AdminSessionTokens;
      let previousHostId: number | null = null;

      if (context.handoffToken) {
        const handoff = await adminSwitchHandoffRepository.findByTokenHash(
          this.hashToken(context.handoffToken),
          transaction,
          true
        );
        if (!handoff || handoff.consumedAt || handoff.expiresAt <= now) {
          throw createConfiguredError('INVALID_SWITCH_HANDOFF', 'Switch handoff is invalid or expired', 401);
        }

        const activeSourceSession = await userRefreshTokenRepository.findActiveByFamily(
          handoff.userId,
          handoff.tokenFamily,
          transaction
        );
        if (!activeSourceSession) {
          throw createConfiguredError('INVALID_SWITCH_HANDOFF', 'The source Super Admin session is no longer active', 401);
        }

        const originalUser = await userRepository.findById(handoff.userId, transaction);
        if (
          !originalUser ||
          originalUser.accountStatus !== 'ACTIVE' ||
          originalUser.isSuperAdmin !== 1
        ) {
          throw createConfiguredError('SUPER_ADMIN_ACCESS_REQUIRED');
        }

        targetHostContext = await hostService.getSwitchHostContext(hostId, transaction, true);
        if (!targetHostContext) {
          throw createConfiguredError('HOST_NOT_ELIGIBLE', 'Host is inactive, deleted, or unavailable', 404, 'NOT_FOUND');
        }

        await handoff.update({ consumedAt: now, updatedAt: now }, { transaction });
        const switchSessionId = crypto.randomUUID();
        const tokenFamily = crypto.randomBytes(16).toString('hex');
        const deviceId = `support-${crypto.randomUUID()}`;
        tokens = this.generateUserSessionTokenBundle({
          hostId: originalUser.hostId,
          userId: originalUser.id,
          tokenFamily,
          deviceType: 'WEB',
          deviceId,
          switchSessionId,
          contextVersion: 1,
        }).sessionTokens;
        const refreshTokenRecord = this.generateRefreshRecordForSwitchSession(
          tokens,
          originalUser.hostId,
          originalUser.id,
          tokenFamily,
          deviceId,
          1
        );
        session = await adminSwitchSessionRepository.create(
          {
            switchSessionId,
            userId: originalUser.id,
            originalHostId: originalUser.hostId,
            sourceTokenFamily: handoff.tokenFamily,
            currentHostId: hostId,
            tokenFamily,
            deviceId,
            contextVersion: 1,
            startedAt: now,
            createdAt: now,
            updatedAt: now,
          },
          transaction
        );
        const refreshRecord = await userRefreshTokenRepository.create(
          refreshTokenRecord,
          transaction
        );
        await adminSwitchSessionRepository.update(
          session,
          { currentRefreshTokenId: refreshRecord.id },
          transaction
        );
        await adminHostSwitchAuditRepository.create(
          {
            switchSessionId,
            originalUserId: originalUser.id,
            originalHostId: originalUser.hostId,
            previousHostId: null,
            newHostId: hostId,
            eventType: 'SWITCH',
            contextVersion: 1,
            requestIp: context.requestIp || null,
            userAgent: context.userAgent || null,
            createdAt: now,
            updatedAt: now,
          },
          transaction
        );
        user = originalUser as unknown as AuthUser;
      } else {
        if (!context.switchSessionId || !context.userId || context.contextVersion === undefined) {
          throw createConfiguredError('INVALID_SWITCH_SESSION', 'An active switch session is required', 401);
        }

        session = await adminSwitchSessionRepository.findBySwitchSessionId(
          context.switchSessionId,
          { transaction, lock: true }
        );
        if (
          !session ||
          session.userId !== context.userId ||
          session.contextVersion !== context.contextVersion
        ) {
          throw createConfiguredError('STALE_SWITCH_CONTEXT', 'Switch context changed; retry with the current session', 409);
        }

        const originalUser = await userRepository.findById(session.userId, transaction);
        if (
          !originalUser ||
          originalUser.accountStatus !== 'ACTIVE' ||
          originalUser.isSuperAdmin !== 1
        ) {
          throw createConfiguredError('SUPER_ADMIN_ACCESS_REQUIRED');
        }

        const activeSourceSession = await userRefreshTokenRepository.findActiveByFamily(
          session.userId,
          session.sourceTokenFamily,
          transaction,
          false
        );
        if (!activeSourceSession) {
          throw createConfiguredError('SUPER_ADMIN_ACCESS_REQUIRED');
        }

        targetHostContext = await hostService.getSwitchHostContext(hostId, transaction, true);
        if (!targetHostContext) {
          throw createConfiguredError('HOST_NOT_ELIGIBLE', 'Host is inactive, deleted, or unavailable', 404, 'NOT_FOUND');
        }

        previousHostId = session.currentHostId;
        const nextContextVersion = session.contextVersion + 1;
        const bundle = this.generateUserSessionTokenBundle({
          hostId: session.originalHostId,
          userId: session.userId,
          tokenFamily: session.tokenFamily,
          deviceType: 'WEB',
          deviceId: session.deviceId,
          switchSessionId: session.switchSessionId,
          contextVersion: nextContextVersion,
        });
        const replacedRefresh = await userRefreshTokenRepository.replaceForSwitchSession(
          {
            switchSessionId: session.switchSessionId,
            userId: session.userId,
            tokenFamily: session.tokenFamily,
            contextVersion: session.contextVersion,
          },
          {
            ...bundle.refreshTokenRecord,
            updatedAt: now,
            revokedAt: now,
            revokedReason: 'HOST_SWITCHED',
          },
          transaction
        );
        if (replacedRefresh.status === 'EXPIRED') {
          throw createConfiguredError('REFRESH_TOKEN_EXPIRED');
        }
        if (replacedRefresh.status !== 'REPLACED') {
          throw createConfiguredError('STALE_SWITCH_CONTEXT', 'Switch context changed; retry with the current session', 409);
        }

        await adminSwitchSessionRepository.update(
          session,
          {
            currentHostId: hostId,
            contextVersion: nextContextVersion,
            currentRefreshTokenId: replacedRefresh.record.id,
            updatedAt: now,
          },
          transaction
        );
        await adminHostSwitchAuditRepository.create(
          {
            switchSessionId: session.switchSessionId,
            originalUserId: originalUser.id,
            originalHostId: session.originalHostId,
            previousHostId,
            newHostId: hostId,
            eventType: 'SWITCH',
            contextVersion: nextContextVersion,
            requestIp: context.requestIp || null,
            userAgent: context.userAgent || null,
            createdAt: now,
            updatedAt: now,
          },
          transaction
        );
        tokens = bundle.sessionTokens;
        user = originalUser as unknown as AuthUser;
      }

      return this.buildAdminSwitchResponse(user, targetHostContext!, session!, tokens);
    });
  }

  private generateRefreshRecordForSwitchSession(
    tokens: AdminSessionTokens,
    hostId: number,
    userId: number,
    tokenFamily: string,
    deviceId: string,
    contextVersion: number
  ) {
    const decoded = jwt.decode(tokens.refreshToken) as jwt.JwtPayload | null;
    if (!decoded?.exp) {
      throw this.createHttpError('Failed to create refresh token', 500);
    }

    return {
      hostId,
      userId,
      tokenHash: tokens.refreshTokenHash,
      tokenFamily,
      deviceType: 'WEB' as const,
      deviceId,
      expiresAt: decoded.exp,
      createdAt: Math.floor(Date.now() / 1000),
      switchSessionId: tokens.switchSessionId,
      contextVersion,
    };
  }

  private async buildAdminSwitchResponse(
    user: AuthUser,
    hostContext: NonNullable<Awaited<ReturnType<typeof hostService.getSwitchHostContext>>>,
    session: NonNullable<Awaited<ReturnType<typeof adminSwitchSessionRepository.findBySwitchSessionId>>>,
    tokens: AdminSessionTokens
  ): Promise<AdminSwitchAuthResponse> {
    const isReadOnly = hostContext.accessMode === 'SUPPORT_READ_ONLY';
    const supportRole = await roleRepository.findActiveByHostAndCode(session.currentHostId, 'ADMIN');
    const permissionsByModule = supportRole
      ? await this.getPermissionsByModuleForUser(
          session.currentHostId,
          supportRole.id,
          user.id
        )
      : [];

    return {
      user: (user as unknown as LoginUser).toJSON(),
      host: hostContext.host,
      accessMode: hostContext.accessMode,
      switchSession: {
        switchSessionId: session.switchSessionId,
        contextVersion: session.contextVersion,
      },
      subscription: {
        status: isReadOnly ? 'INACTIVE' : 'ACTIVE',
        canUseApp: !isReadOnly,
        isReadOnly,
        canRenew: false,
      },
      permissionsByModule,
      accessToken: tokens.accessToken,
      refreshToken: tokens.refreshToken,
      csrfToken: tokens.csrfToken,
    };
  }

  async refreshAdminSession(refreshToken: string): Promise<AdminAuthResponse> {
    const payload = this.verifyRefreshToken(refreshToken);
    if (payload.switchSessionId) {
      return this.refreshAdminSwitchSession(refreshToken, payload);
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    if (user.accountStatus !== 'ACTIVE') {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ACCOUNT_INACTIVE');
    }

    if (!user.isAdminUser) {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ADMIN_PORTAL_ACCESS_DENIED');
    }

    const rotatedTokens = await this.rotateUserSessionTokens(refreshToken, payload, user, 'WEB');
    const permissionsByModule = await this.getPermissionsByModuleForUser(
      user.hostId,
      user.roleId,
      user.id
    );

    // Check if the host has an active subscription, this will throw an error if not active
    const subscription = await this.getSubscriptionStatusForHost(user.hostId, 'ADMIN');

    return {
      user: user.toJSON(),
      //permissions,
      subscription,
      permissionsByModule,
      accessToken: rotatedTokens.accessToken,
      refreshToken: rotatedTokens.refreshToken,
      csrfToken: rotatedTokens.csrfToken,
    };
  }

  async logoutAdminSession(refreshToken?: string, accessToken?: string): Promise<void> {
    if (refreshToken) {
      try {
        const payload = this.verifyRefreshToken(refreshToken);
        if (payload.switchSessionId) {
          await this.terminateAdminSwitchSession(payload, 'LOGOUT');
          return;
        }

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
        return;
      } catch {
        // A valid switch access token may still terminate the session if refresh state is missing.
      }
    }

    if (!accessToken) {
      return;
    }

    try {
      const payload = jwt.verify(accessToken, getJwtSecret()) as JwtPayload;
      if (
        payload.tokenType === 'access' &&
        payload.authContext === 'ADMIN_SWITCH' &&
        payload.switchSessionId &&
        payload.contextVersion !== undefined
      ) {
        await this.terminateAdminSwitchSessionByAccess(payload, 'LOGOUT');
      }
    } catch {
      return;
    }
  }

  private async refreshAdminSwitchSession(
    refreshToken: string,
    payload: RefreshTokenPayload
  ): Promise<AdminSwitchAuthResponse> {
    if (!payload.switchSessionId || payload.contextVersion === undefined) {
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    const outcome = await sequelize.transaction(async (transaction) => {
      const session = await adminSwitchSessionRepository.findBySwitchSessionId(
        payload.switchSessionId!,
        { transaction, lock: true }
      );
      if (
        !session ||
        session.userId !== payload.userId ||
        session.tokenFamily !== payload.tokenFamily
      ) {
        throw createConfiguredError('INVALID_SWITCH_SESSION');
      }

      const user = await userRepository.findById(session.userId, transaction);
      if (!user || user.accountStatus !== 'ACTIVE' || user.isSuperAdmin !== 1) {
        await this.endAdminSwitchSession(session, 'ACCOUNT_INACTIVE', transaction);
        return { errorCode: 'SUPER_ADMIN_ACCESS_REQUIRED' as const };
      }

      const activeSourceSession = await userRefreshTokenRepository.findActiveByFamily(
        session.userId,
        session.sourceTokenFamily,
        transaction,
        false
      );
      if (!activeSourceSession) {
        await this.endAdminSwitchSession(session, 'SOURCE_SESSION_REVOKED', transaction);
        return { errorCode: 'SUPER_ADMIN_ACCESS_REQUIRED' as const };
      }

      const hostContext = await hostService.getSwitchHostContext(
        session.currentHostId,
        transaction,
        true
      );
      if (!hostContext) {
        await this.endAdminSwitchSession(session, 'HOST_INELIGIBLE', transaction);
        return { errorCode: 'HOST_NOT_ELIGIBLE' as const };
      }

      const now = Math.floor(Date.now() / 1000);
      const nextContextVersion = session.contextVersion + 1;
      const result = await userRefreshTokenRepository.rotateByTokenHash(
        this.hashToken(refreshToken),
        {
          userId: session.userId,
          tokenFamily: session.tokenFamily,
          switchSessionId: session.switchSessionId,
          contextVersion: session.contextVersion,
        },
        (current) => {
          const bundle = this.generateUserSessionTokenBundle({
            hostId: session.originalHostId,
            userId: session.userId,
            tokenFamily: session.tokenFamily,
            deviceType: 'WEB',
            deviceId: session.deviceId,
            switchSessionId: session.switchSessionId,
            contextVersion: nextContextVersion,
          });
          return {
            data: {
              ...bundle.refreshTokenRecord,
              updatedAt: now,
              revokedAt: now,
              revokedReason: 'ROTATED',
            },
            value: bundle,
          };
        },
        transaction
      );

      if (result.status === 'REPLAY') {
        await this.endAdminSwitchSession(session, 'REFRESH_REPLAY', transaction);
        return { errorCode: 'REFRESH_TOKEN_REUSE_DETECTED' as const };
      }
      if (result.status === 'EXPIRED') {
        return { errorCode: 'REFRESH_TOKEN_EXPIRED' as const };
      }
      if (result.status !== 'ROTATED') {
        return { errorCode: 'INVALID_REFRESH_TOKEN' as const };
      }

      await adminSwitchSessionRepository.update(
        session,
        {
          currentRefreshTokenId: session.currentRefreshTokenId,
          contextVersion: nextContextVersion,
          updatedAt: now,
        },
        transaction
      );

      return {
        response: await this.buildAdminSwitchResponse(
          user as unknown as AuthUser,
          hostContext,
          session,
          result.value.sessionTokens
        ),
      };
    });

    if ('errorCode' in outcome) {
      throw createConfiguredError(outcome.errorCode);
    }
    return outcome.response;
  }

  private async terminateAdminSwitchSession(
    payload: RefreshTokenPayload,
    reason: string
  ): Promise<void> {
    if (!payload.switchSessionId) {
      return;
    }

    await sequelize.transaction(async (transaction) => {
      const session = await adminSwitchSessionRepository.findBySwitchSessionId(
        payload.switchSessionId!,
        { transaction, lock: true }
      );
      if (
        !session ||
        session.userId !== payload.userId ||
        session.tokenFamily !== payload.tokenFamily ||
        session.contextVersion !== payload.contextVersion
      ) {
        return;
      }
      await this.endAdminSwitchSession(session, reason, transaction);
    });
  }

  private async terminateAdminSwitchSessionByAccess(
    payload: JwtPayload,
    reason: string
  ): Promise<void> {
    if (!payload.switchSessionId || payload.contextVersion === undefined) {
      return;
    }

    await sequelize.transaction(async (transaction) => {
      const session = await adminSwitchSessionRepository.findBySwitchSessionId(
        payload.switchSessionId!,
        { transaction, lock: true }
      );
      if (
        !session ||
        session.userId !== payload.userId ||
        session.contextVersion !== payload.contextVersion
      ) {
        return;
      }
      await this.endAdminSwitchSession(session, reason, transaction);
    });
  }

  private async endAdminSwitchSession(
    session: NonNullable<Awaited<ReturnType<typeof adminSwitchSessionRepository.findBySwitchSessionId>>>,
    reason: string,
    transaction: Transaction
  ): Promise<void> {
    const now = Math.floor(Date.now() / 1000);
    await session.update(
      { isActive: 0, endedAt: now, updatedAt: now },
      { transaction }
    );
    await userRefreshTokenRepository.revokeActiveForFamily(
      session.userId,
      session.tokenFamily,
      transaction,
      reason
    );
    await adminHostSwitchAuditRepository.create(
      {
        switchSessionId: session.switchSessionId,
        originalUserId: session.userId,
        originalHostId: session.originalHostId,
        previousHostId: session.currentHostId,
        newHostId: null,
        eventType: 'SESSION_TERMINATED',
        contextVersion: session.contextVersion,
        createdAt: now,
        updatedAt: now,
      },
      transaction
    );
  }

  async refreshAppSession(refreshToken: string): Promise<AuthResponse> {
    const payload = this.verifyRefreshToken(refreshToken);
    if (payload.switchSessionId) {
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    let user = await userRepository.findById(payload.userId);
    user = (user?.get ? user.get({ plain: true }) : user) as unknown as LoginUser;
    if (!user) {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    if (user.accountStatus !== 'ACTIVE') {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ACCOUNT_INACTIVE');
    }

    //const isAllowedAppLogin = await isAppLoginRole(user.hostId, user.roleId);
    if (!user.isFieldAppUser) {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('APP_LOGIN_ACCESS_DENIED');
    }

    const rotatedTokens = await this.rotateUserSessionTokens(
      refreshToken,
      payload,
      user,
      'ANDROID'
    );
    const permissionsByModule = await this.getPermissionsByModuleForUser(
      user.hostId,
      user.roleId,
      user.id
    );

    // Fetch user settings separately since they're in a different table
    const userSettings = await UserSettings.findAll({
      where: { userId: user.id, isDeleted: 0 },
      attributes: ['settingName', 'settingValue', 'isEnabled'],
      raw: true,
    });

    // Attach settings array to user object
    (user as any).settings = userSettings || [];

    // Attach active attendance locations (used for geo-fencing on attendance marking)
    (user as any).attendanceLocations = await userRepository.getAttendanceSitesForUser(user.id);

    // Format user data with settings, datetime, and storage fields
    const formattedUser = await this.formatUserWithSettings(user);

    // Fetch subscription status for the host
    const subscription = await this.getSubscriptionStatusForHost(user.hostId, 'APP');

    return {
      user: formattedUser,
      accessToken: rotatedTokens.accessToken,
      refreshToken: rotatedTokens.refreshToken,
      permissionsByModule,
      subscription,
    };
  }

  private async validateHostSpecificCredentials(data: HostSpecificLoginDto): Promise<LoginUser> {
    const { email, password, hostId } = data;

    const user = await userRepository.findWithHostIdAndEmail(email, hostId);
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

  async changePassword(data: ChangePasswordDto): Promise<AdminSessionTokens | null> {
    try {
      return await this.executeChangePassword(data);
    } catch (error) {
      if (!this.isDeadlockError(error)) {
        throw error;
      }
      // The failed transaction is fully rolled back before this single retry.
      return await this.executeChangePassword(data);
    }
  }

  private isDeadlockError(error: unknown): boolean {
    const dbError = error as { parent?: { code?: string }; original?: { code?: string } };
    return (
      dbError?.parent?.code === 'ER_LOCK_DEADLOCK' ||
      dbError?.original?.code === 'ER_LOCK_DEADLOCK'
    );
  }

  private async executeChangePassword(data: ChangePasswordDto): Promise<AdminSessionTokens | null> {
    const { userId, currentPassword, newPassword, currentRefreshToken } = data;

    return sequelize.transaction(async (transaction) => {
      // Lock the user row first: replaceForDevice (login) takes the same lock,
      // which serializes password changes against concurrent logins.
      const user = await userRepository.findByIdWithPassword(userId, transaction, true);
      if (!user) {
        throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404, 'NOT_FOUND');
      }

      if (user.accountStatus != 'ACTIVE') {
        throw createConfiguredError('ACCOUNT_INACTIVE');
      }

      const isCurrentPasswordValid = await bcrypt.compare(currentPassword, user.password);
      if (!isCurrentPasswordValid) {
        throw createConfiguredError('CURRENT_PASSWORD_INCORRECT');
      }

      const patternResult = validatePasswordPattern(newPassword);
      if (!patternResult.isValid) {
        throw createConfiguredError('PASSWORD_POLICY_VIOLATION');
      }

      const now = Math.floor(Date.now() / 1000);

      // Hashing is handled by the User model's beforeUpdate hook
      user.password = newPassword;
      user.passwordChangedAt = now;
      await user.save({ transaction });

      const currentTokenRecord = await this.resolveCurrentTokenRecord(
        userId,
        currentRefreshToken,
        transaction
      );
      const keepTokenFamily = currentTokenRecord?.tokenFamily ?? null;

      // Lock switch-session rows before the bulk token revocation to keep the
      // session-row -> token-row lock order used by the host-switch flows.
      const activeSwitchSessions = await adminSwitchSessionRepository.findActiveByUser(
        userId,
        transaction
      );

      await userRefreshTokenRepository.revokeActiveForUserExceptFamily(
        userId,
        keepTokenFamily,
        transaction,
        'PASSWORD_CHANGED'
      );

      for (const session of activeSwitchSessions) {
        if (keepTokenFamily && session.sourceTokenFamily === keepTokenFamily) {
          continue;
        }
        await this.endAdminSwitchSession(session, 'PASSWORD_CHANGED', transaction);
      }

      if (!currentTokenRecord || !currentRefreshToken) {
        return null;
      }

      // Rotate the current session's credentials so its new access token
      // carries the new passwordChangedAt generation and stays usable.
      const rotation = await userRefreshTokenRepository.rotateByTokenHash(
        this.hashToken(currentRefreshToken),
        { userId, tokenFamily: currentTokenRecord.tokenFamily },
        (current) => {
          const bundle = this.generateUserSessionTokenBundle({
            hostId: current.hostId,
            userId,
            tokenFamily: current.tokenFamily,
            deviceType: current.deviceType,
            deviceId: current.deviceId,
            passwordChangedAt: now,
          });
          return {
            data: {
              ...bundle.refreshTokenRecord,
              updatedAt: now,
              revokedAt: now,
              revokedReason: 'ROTATED',
            },
            value: bundle,
          };
        },
        transaction
      );

      if (rotation.status !== 'ROTATED') {
        // Fail secure: without rotated credentials the current session cannot
        // outlive the password change, so its family is revoked as well.
        await userRefreshTokenRepository.revokeActiveForFamily(
          userId,
          currentTokenRecord.tokenFamily,
          transaction,
          'PASSWORD_CHANGED'
        );
        return null;
      }

      return rotation.value.sessionTokens;
    });
  }

  /**
   * Fail-secure resolution of the caller's current refresh-token record.
   * Returns null when the token is missing, invalid, expired, revoked or not
   * owned by the authenticated user; callers then revoke ALL active sessions.
   */
  private async resolveCurrentTokenRecord(
    userId: number,
    currentRefreshToken: string | undefined,
    transaction: Transaction
  ): Promise<Awaited<ReturnType<typeof userRefreshTokenRepository.findByTokenHash>>> {
    if (!currentRefreshToken) {
      return null;
    }

    try {
      const payload = this.verifyRefreshToken(currentRefreshToken);
      if (payload.userId !== userId || payload.switchSessionId) {
        return null;
      }

      const tokenRecord = await userRefreshTokenRepository.findByTokenHash(
        this.hashToken(currentRefreshToken),
        transaction,
        true
      );
      const now = Math.floor(Date.now() / 1000);
      if (
        !tokenRecord ||
        tokenRecord.userId !== userId ||
        tokenRecord.tokenFamily !== payload.tokenFamily ||
        tokenRecord.isRevoked === 1 ||
        tokenRecord.expiresAt <= now
      ) {
        return null;
      }

      return tokenRecord;
    } catch {
      return null;
    }
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

  private generateAccessToken(
    userId: number,
    deviceType: 'WEB' | 'ANDROID' | 'IOS' = 'WEB',
    sessionId: string,
    switchContext?: { switchSessionId: string; contextVersion: number },
    passwordChangedAt?: number | null
  ): string {
    const secret = getJwtSecret();
    const expiresIn = getJwtExpiresIn(deviceType);

    return jwt.sign(
      {
        userId,
        tokenType: 'access',
        sessionId,
        ...(switchContext
          ? {
              authContext: 'ADMIN_SWITCH',
              switchSessionId: switchContext.switchSessionId,
              contextVersion: switchContext.contextVersion,
            }
          : // Non-switch tokens always carry the password generation they were
            // issued for; tokens from before the latest change are rejected.
            { passwordChangedAt: passwordChangedAt ?? 0 }),
      },
      secret,
      { expiresIn }
    );
  }

  private generateUserSessionTokenBundle(payload: {
    hostId: number;
    userId: number;
    tokenFamily?: string;
    deviceType?: 'WEB' | 'ANDROID' | 'IOS';
    deviceId: string;
    deviceName?: string | null;
    appVersion?: string | null;
    lastUsedAt?: number | null;
    switchSessionId?: string;
    contextVersion?: number;
    passwordChangedAt?: number | null;
  }) {
    const refreshSecret = getJwtRefreshSecret();
    const refreshExpiresIn = getJwtRefreshExpiresIn(payload.deviceType);
    const { hostId, userId, tokenFamily } = payload;
    const finalTokenFamily = tokenFamily || crypto.randomBytes(16).toString('hex');

    const refreshToken = jwt.sign(
      {
        hostId,
        userId,
        tokenFamily: finalTokenFamily,
        tokenType: 'refresh',
        jti: crypto.randomUUID(),
        ...(payload.switchSessionId
          ? {
              switchSessionId: payload.switchSessionId,
              contextVersion: payload.contextVersion,
            }
          : {}),
      },
      refreshSecret,
      { expiresIn: refreshExpiresIn }
    );

    const decodedRefreshToken = jwt.decode(refreshToken) as jwt.JwtPayload | null;
    if (!decodedRefreshToken?.exp) {
      throw this.createHttpError('Failed to create refresh token', 500);
    }

    const refreshTokenHash = this.hashToken(refreshToken);

    const sessionId = crypto.randomUUID();

    const refreshTokenRecord = {
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
      createdAt: Math.floor(Date.now() / 1000),
      ...(payload.switchSessionId
        ? {
            switchSessionId: payload.switchSessionId,
            contextVersion: payload.contextVersion ?? 1,
          }
        : {}),
    };

    return {
      refreshTokenRecord,
      sessionTokens: {
        accessToken: this.generateAccessToken(
          userId,
          payload.deviceType || 'WEB',
          sessionId,
          payload.switchSessionId
            ? {
                switchSessionId: payload.switchSessionId,
                contextVersion: payload.contextVersion || 1,
              }
            : undefined,
          payload.passwordChangedAt
        ),
        refreshToken,
        refreshTokenHash,
        tokenFamily: finalTokenFamily,
        csrfToken: this.createCsrfToken(),
        sessionId,
        switchSessionId: payload.switchSessionId,
        contextVersion: payload.contextVersion,
      } satisfies AdminSessionTokens,
    };
  }

  private async createUserSessionTokens(payload: {
    hostId: number;
    userId: number;
    tokenFamily?: string;
    deviceType?: 'WEB' | 'ANDROID' | 'IOS';
    deviceId: string;
    deviceName?: string | null;
    appVersion?: string | null;
    lastUsedAt?: number | null;
    passwordChangedAt?: number | null;
    expectedPasswordHash?: string;
  }): Promise<AdminSessionTokens> {
    const { expectedPasswordHash, ...bundlePayload } = payload;
    const bundle = this.generateUserSessionTokenBundle(bundlePayload);
    await userRefreshTokenRepository.replaceForDevice(
      bundle.refreshTokenRecord,
      expectedPasswordHash
    );
    await userRepository.updateUserDeviceDetails({
      hostId: payload.hostId,
      userId: payload.userId,
      deviceId: payload.deviceId,
      sessionId: bundle.sessionTokens.sessionId,
    });

    return bundle.sessionTokens;
  }

  private async rotateUserSessionTokens(
    refreshToken: string,
    payload: RefreshTokenPayload,
    user: AuthUser,
    deviceType: 'WEB' | 'ANDROID' | 'IOS'
  ): Promise<AdminSessionTokens> {
    const tokenHash = this.hashToken(refreshToken);
    const now = Math.floor(Date.now() / 1000);
    const result = await userRefreshTokenRepository.rotateByTokenHash(
      tokenHash,
      { userId: payload.userId, tokenFamily: payload.tokenFamily },
      (current) => {
        const bundle = this.generateUserSessionTokenBundle({
          hostId: user.hostId,
          userId: user.id,
          tokenFamily: payload.tokenFamily,
          deviceType,
          deviceId: current.deviceId,
          passwordChangedAt: user.passwordChangedAt ?? 0,
        });

        return {
          data: {
            ...bundle.refreshTokenRecord,
            updatedAt: now,
            revokedAt: now,
            revokedReason: 'ROTATED',
          },
          value: bundle,
        };
      }
    );

    if (result.status === 'REPLAY') {
      throw createConfiguredError('REFRESH_TOKEN_REUSE_DETECTED');
    }
    if (result.status === 'EXPIRED') {
      throw createConfiguredError('REFRESH_TOKEN_EXPIRED');
    }
    if (result.status !== 'ROTATED') {
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    await userRepository.updateUserDeviceDetails({
      hostId: user.hostId,
      userId: user.id,
      deviceId: result.value.refreshTokenRecord.deviceId,
      sessionId: result.value.sessionTokens.sessionId,
    });

    return result.value.sessionTokens;
  }

  private async resolveUserDeviceId(
    hostId: number,
    userId: number,
    preferredDeviceId?: string | null
  ): Promise<string> {
    const trimmedPreferredDeviceId = preferredDeviceId?.trim();
    if (trimmedPreferredDeviceId) {
      return trimmedPreferredDeviceId;
    }

    const persistedDeviceId = await userRepository.getLatestDeviceIdByUser(hostId, userId);
    if (persistedDeviceId) {
      return persistedDeviceId;
    }

    throw createConfiguredError(
      'INVALID_DEVICE_DETAILS',
      'Device ID is required for app session',
      400,
      'VALIDATION_ERROR'
    );
  }

  private verifyRefreshToken(token: string): RefreshTokenPayload {
    try {
      const secret = getJwtRefreshSecret();
      const decoded = jwt.verify(token, secret) as RefreshTokenPayload;

      if (decoded.tokenType !== 'refresh' || !decoded.userId || !decoded.tokenFamily) {
        throw this.createHttpError('Invalid refresh token', 401);
      }

      if (
        (decoded.switchSessionId &&
          (!Number.isSafeInteger(decoded.contextVersion) || Number(decoded.contextVersion) < 1)) ||
        (!decoded.switchSessionId && decoded.contextVersion !== undefined)
      ) {
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
      throw createConfiguredError(
        'INVALID_FILTER',
        'Filter must be a valid object',
        400,
        'VALIDATION_ERROR'
      );
    }
    const users = await userRepository.getUsersByFilter(filter);
    return {
      users: users,
    };
  }

  async saveOtpForUser(payload: {
    hostId: number;
    userId: number;
    identifierType: string;
    identifierValue: string;
    otpCode: string;
    expiresAt: number;
    purpose: string;
    messageId?: string;
    maxAttempts: number;
    requestIp: string;
    createdAt: number;
    otpDeliveries: Array<{
      deliveryChannel: string;
      destination: string;
      messageId?: string;
      provider?: string;
      status?: string | null;
      failedReason?: string | null;
    }>;
  }): Promise<void> {
    const { userId } = payload;
    const user = await userRepository.findById(userId);
    if (!user) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found', 404, 'NOT_FOUND');
    }
    return await userRepository.saveOtpForUser(payload);
  }

  async getUserByIdentifier(payload: { identifier: string; deviceId?: string }): Promise<any> {
    let { identifier, deviceId } = payload;
    identifier = identifier?.trim(); // Trim whitespace from the identifier

    // Validate the identifier exists and is not empty
    if (!identifier) {
      throw createConfiguredError(
        'INVALID_IDENTIFIER',
        'Please enter email or mobile number.',
        400,
        'VALIDATION_ERROR'
      );
    }

    // Determine if the identifier is an email or mobile number
    const parseIdentifierResult = CommonUtil.parseIdentifier(identifier);
    if (!parseIdentifierResult.type) {
      throw createConfiguredError(
        'INVALID_IDENTIFIER',
        'Invalid value. Must be a valid email or phone number.',
        400,
        'VALIDATION_ERROR'
      );
    }

    let whereClause: Record<string, any> = {
      accountStatus: 'ACTIVE',
      deviceId: deviceId || null, // Include deviceId in the filter if provided
      isDeleted: 0,
    };

    if (parseIdentifierResult.type === 'EMAIL') {
      whereClause.email = parseIdentifierResult.email;
    } else if (parseIdentifierResult.type === 'MOBILE') {
      whereClause.mobile = parseIdentifierResult.mobile;
    }

    const getUsersResult = await this.getUsersByFilter(whereClause);
    const users = getUsersResult.users || [];

    if (!users || users.length === 0) {
      throw createConfiguredError(
        'USER_NOT_FOUND',
        'You are not registered. Please contact your administrator.',
        404,
        'NOT_FOUND'
      );
    }

    if (users.length > 1) {
      throw createConfiguredError(
        'MULTIPLE_USERS_FOUND',
        'Multiple users found with the same identifier. Please contact your administrator.',
        400,
        'VALIDATION_ERROR'
      );
    }

    const user = users[0];
    return user;
  }

  ///////////////////// Super Admin Authentication Methods ///////////////////////
  async superAdminLogin(data: LoginDto): Promise<SuperAdminAuthResponse> {
    const user = await this.validateCredentials(data);

    //const isAdmin = await isAdminRole(user.hostId, user.roleId);
    if (!user.isSuperAdmin) {
      throw createConfiguredError('SUPER_ADMIN_PORTAL_ACCESS_DENIED');
    }

    const sessionTokens = await this.createUserSessionTokens({
      hostId: user.hostId,
      userId: user.id,
      deviceType: 'WEB',
      deviceId: data.deviceDetails?.deviceId || 'default',
      passwordChangedAt: user.passwordChangedAt ?? 0,
      expectedPasswordHash: user.password,
    });

    return {
      user: user.toJSON(),
      accessToken: sessionTokens.accessToken,
      refreshToken: sessionTokens.refreshToken,
      csrfToken: sessionTokens.csrfToken,
    };
  }

  async refreshSuperAdminSession(refreshToken: string): Promise<SuperAdminAuthResponse> {
    const payload = this.verifyRefreshToken(refreshToken);
    if (payload.switchSessionId) {
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    const user = await userRepository.findById(payload.userId);
    if (!user) {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('INVALID_REFRESH_TOKEN');
    }

    if (user.accountStatus !== 'ACTIVE') {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('ACCOUNT_INACTIVE');
    }

    if (!user.isSuperAdmin) {
      await userRefreshTokenRepository.revokeAllActiveForUser(payload.userId);
      throw createConfiguredError('SUPER_ADMIN_ACCESS_DENIED');
    }

    const rotatedTokens = await this.rotateUserSessionTokens(refreshToken, payload, user, 'WEB');

    return {
      user: user.toJSON(),
      accessToken: rotatedTokens.accessToken,
      refreshToken: rotatedTokens.refreshToken,
      csrfToken: rotatedTokens.csrfToken,
    };
  }

  async logoutSuperAdminSession(refreshToken?: string): Promise<void> {
    if (!refreshToken) {
      return;
    }

    try {
      const payload = this.verifyRefreshToken(refreshToken);
      if (payload.switchSessionId) {
        await this.terminateAdminSwitchSession(payload, 'LOGOUT');
        return;
      }

      await sequelize.transaction(async (transaction) => {
        const sourceSession = await userRefreshTokenRepository.findActiveByFamily(
          payload.userId,
          payload.tokenFamily,
          transaction,
          true
        );
        if (
          !sourceSession ||
          sourceSession.hostId !== payload.hostId ||
          sourceSession.deviceType !== 'WEB'
        ) {
          return;
        }

        await userRefreshTokenRepository.revokeActiveForFamily(
          payload.userId,
          payload.tokenFamily,
          transaction,
          'LOGOUT'
        );
        const derivedSessions = await adminSwitchSessionRepository.findActiveBySourceSession(
          payload.userId,
          payload.tokenFamily,
          transaction
        );
        for (const session of derivedSessions) {
          await this.endAdminSwitchSession(session, 'SOURCE_SESSION_LOGOUT', transaction);
        }
      });
    } catch {
      return;
    }
  }

  async doesSubDomainExist(subDomain: string): Promise<boolean> {
    const existingHost = await hostService.getHostBySubDomain({ subDomain });
    return !!existingHost?.data?.id;
  }

  async getSubDomainDetails(subDomain: string): Promise<any> {
    const subDomainDetails = await hostService.getHostBySubDomain({ subDomain });
    return subDomainDetails?.data || null;
  }
}

export default new AuthService();
