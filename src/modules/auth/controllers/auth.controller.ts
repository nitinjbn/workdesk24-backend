import { Request, Response, NextFunction } from 'express';
import authService from '../services/auth.service';
import { ApiResponse } from '../../../shared/types/base.types';
import authNotificationService from '../../notifications/auth/authNotificationService';
import { CommonUtil } from '../../../shared/utils/common.util';
import { CONFIG } from '../../../config/constants';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

export class AuthController {
  async requestOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let { identifier, deviceDetails } = req.body;
      const user = await authService.getUserByIdentifier({ identifier });
      if (!user) {
        res.status(404).json({
          success: false,
          message: 'User not found',
        } as ApiResponse);
        return;
      }

      // Save fcmToken if provided in the request body
      if (deviceDetails?.fcmToken) {
        await authService.updateUserDeviceDetails({
          hostId: user.hostId,
          userId: user.id,
          deviceId: deviceDetails.deviceId,
          deviceName: deviceDetails.deviceName,
          deviceModel: deviceDetails.deviceModel,
          manufacturer: deviceDetails.manufacturer,
          brand: deviceDetails.brand,
          device: deviceDetails.device,
          product: deviceDetails.product,
          hardware: deviceDetails.hardware,
          osVersion: deviceDetails.osVersion,
          sdkInt: deviceDetails.sdkInt,
          appVersion: deviceDetails.appVersion,
          storageTotalBytes: deviceDetails.storageTotalBytes,
          storageAvailableBytes: deviceDetails.storageAvailableBytes,
          storageUsedBytes: deviceDetails.storageUsedBytes,
          fcmToken: deviceDetails.fcmToken,
        });
      }
      
      //console.log("################ AuthController.requestOtp: User found:", user);
      const { email, mobile } = user;
      const otpCode = CommonUtil.generateOTP(CONFIG.OTP.AUTH.CODE_LENGTH);

      if (!email || !otpCode) {
        res.status(400).json({
          success: false,
          message: 'email and otpCode are required',
        } as ApiResponse);
        return;
      }

      const sendEmailOtpResult = await authNotificationService.sendOtpEmail({
        email,
        otpCode,
        purpose: CONFIG.OTP.AUTH.LABEL,
        appName: CONFIG.APP_CONFIG.NAME,
        expiryMinutes: CONFIG.OTP.AUTH.EXPIRY_MINUTES,
      });
      //console.log("################ AuthController.requestOtp: OTP email sent successfully:", sendEmailOtpResult);

      if (!sendEmailOtpResult || !sendEmailOtpResult.messageId) {
        res.status(500).json({
          success: false,
          message: 'Failed to send OTP email. Please try again later.',
        } as ApiResponse);
        return;
      }

      // Determine the status of email OTP sending
      const emailOtpStatus = sendEmailOtpResult.messageId ? true : false;
      const smsOtpStatus = false; // SMS sending is not implemented yet

      if(emailOtpStatus) {
        console.log(`OTP email sent successfully to ${email}. Message ID: ${sendEmailOtpResult.messageId}`);

        // Save the OTP code and its expiry time in the database for the user
        const currentTime = DateTimeFormatUtil.getCurrentUnixTime();
        const otpExpiryTime = currentTime + (CONFIG.OTP.AUTH.EXPIRY_MINUTES * 60);
        const saveOtpResult = await authService.saveOtpForUser({
          hostId: user.hostId,
          userId: user.id,
          identifierType: 'EMAIL',
          identifierValue: email,
          otpCode,
          messageId: sendEmailOtpResult.messageId,
          expiresAt: otpExpiryTime,
          purpose: CONFIG.OTP.AUTH.PURPOSE_KEY,
          deliveryChannel: 'EMAIL',
          maxAttempts: CONFIG.OTP.AUTH.MAX_ATTEMPTS,
          requestIp: req.ip,
          createdAt: currentTime
        });
        console.log(`OTP code saved for user ${user.id}. Save result:`, saveOtpResult);
      }

      res.json({
        success: true,
        message: CommonUtil.buildOtpDeliveryMessage({
          email,
          mobile,
          emailOtpStatus,
          smsOtpStatus
        }),
        data: {
          email: emailOtpStatus,
          sms: smsOtpStatus,
          deliveryTargets: {
            email: emailOtpStatus && email ? CommonUtil.maskEmail(email) : null,
            mobile: smsOtpStatus && mobile ? CommonUtil.maskMobile(mobile) : null,
          }
        }
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async verifyOtp(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      let { identifier, otpCode, deviceDetails } = req.body;
      identifier = identifier?.trim();
      otpCode = otpCode?.toString().trim();

      if (!identifier || !otpCode) {
        res.status(400).json({
          success: false,
          message: 'Identifier and OTP code are required',
        } as ApiResponse);
        return;
      }

      const result = await authService.verifyOtp({ identifier, otpCode, deviceDetails });

      res.json({
        success: true,
        message: 'OTP verification successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          permissions: result.permissionsByModule,
        },
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async register(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, email, password, name, roleId, designationId, mobile, employeeCode, reportingManagerId, profileImageUrl, joiningDate } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        } as ApiResponse);
        return;
      }

      const result = await authService.register({ hostId, email, password, name, roleId, designationId, mobile, employeeCode, reportingManagerId, profileImageUrl, joiningDate });

      res.status(201).json({
        success: true,
        message: 'User registered successfully',
        data: result,
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async login(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { email, password } = req.body;

      if (!email || !password) {
        res.status(400).json({
          success: false,
          message: 'Email and password are required',
        } as ApiResponse);
        return;
      }

      const result = await authService.login({ email, password });

      res.json({
        success: true,
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          permissions: result.permissionsByModule,
        },
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async refresh(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const refreshToken = req.headers['x-refresh-token'] as string;

      if (!refreshToken) {
        res.status(400).json({
          success: false,
          message: 'Refresh token is required in x-refresh-token header',
        } as ApiResponse);
        return;
      }

      const result = await authService.refreshAppSession(refreshToken);

      res.json({
        success: true,
        message: 'Token refreshed successfully',
        data: {
          user: result.user,
          accessToken: result.accessToken,
          refreshToken: result.refreshToken,
          permissions: result.permissionsByModule,
        },
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async updateFcmToken(req: Request, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, userId, deviceId, fcmToken } = req.body;

      if (!hostId || !userId || !deviceId || !fcmToken) {
        res.status(400).json({
          success: false,
          message: 'hostId, userId, deviceId, and fcmToken are required',
        } as ApiResponse);
        return;
      }

      await authService.updateUserDeviceDetails({
        hostId,
        userId,
        deviceId,
        fcmToken,
      });

      res.json({
        success: true,
        message: 'FCM token updated successfully',
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }
}

export default new AuthController();
