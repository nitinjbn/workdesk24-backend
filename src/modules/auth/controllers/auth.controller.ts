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

      const fcmToken = deviceDetails?.fcmToken?.trim();
      const currentTime = DateTimeFormatUtil.getCurrentUnixTime();

      let sendEmailOtpResult: { deliveryChannel: "EMAIL", destination: string; messageId?: string; provider?: string; status?: string | null; failedReason?: string | null; sentAt?: number | null } = { deliveryChannel: "EMAIL", destination: email, messageId: null, provider: null, status: null, failedReason: null, sentAt: null };
      try {
        console.log(`Sending OTP email to ${email} for user ${user.id}. OTP Code: ${otpCode}`);
        sendEmailOtpResult = await authNotificationService.sendOtpEmail({
          email,
          otpCode,
          purpose: CONFIG.OTP.AUTH.LABEL,
          appName: CONFIG.APP_CONFIG.NAME,
          expiryMinutes: CONFIG.OTP.AUTH.EXPIRY_MINUTES,
        });
        console.log(`OTP email sent for user ${user.id}. Message ID: ${sendEmailOtpResult.messageId || 'N/A'}`);
        //console.log("################ AuthController.requestOtp: OTP email sent successfully:", sendEmailOtpResult);
      } catch (logError) {
        console.error(`Failed to log OTP sending attempt for user ${user.id}:`, logError);
        sendEmailOtpResult = { deliveryChannel: "EMAIL", destination: email, messageId: null, provider: null, status: "FAILED", failedReason: logError?.message || 'Failed to send OTP email', sentAt: null };
      }
      

      let sendPushOtpResult: { deliveryChannel: "PUSH", destination: string; messageId?: string; provider?: string; status?: string | null; failedReason?: string | null, sentAt?: number | null } | null = { deliveryChannel: "PUSH", destination: fcmToken || '', messageId: null, provider: null, status: null, failedReason: null, sentAt: null };
      if (fcmToken) {
        try {
          sendPushOtpResult = await authNotificationService.sendOtpPushNotification({
            fcmToken,
            otpCode,
            purpose: CONFIG.OTP.AUTH.LABEL,
            appName: CONFIG.APP_CONFIG.NAME,
            expiryMinutes: CONFIG.OTP.AUTH.EXPIRY_MINUTES,
          });
          //console.log("################ AuthController.requestOtp: OTP push notification sent successfully:", sendPushOtpResult);
          console.log(`OTP push notification sent for user ${user.id}. Message ID: ${sendPushOtpResult.messageId || 'N/A'}`);
        } catch (pushError: any) {
          console.error(`Failed to send OTP push notification for user ${user.id}:`, pushError?.message || pushError);
          sendPushOtpResult = { deliveryChannel: "PUSH", destination: fcmToken || '', messageId: null, provider: null, status: "FAILED", failedReason: pushError?.message || 'Failed to send OTP push notification', sentAt: null };
        }
      }

      // If both email and push OTP sending failed, return an error response
      if (sendEmailOtpResult?.status === "FAILED" && sendPushOtpResult?.status === "FAILED") {
        res.status(500).json({
          success: false,
          message: 'Failed to send OTP. Please try again later.',
        } as ApiResponse);
        return;
      }

      // Determine the status of email OTP sending
      const emailOtpStatus = sendEmailOtpResult.messageId ? true : false;
      const smsOtpStatus = false; // SMS sending is not implemented yet
      const pushOtpStatus = !!sendPushOtpResult?.messageId;

      if(emailOtpStatus || pushOtpStatus) {
        const otpDeliveriesResults = [];
        if(email) {
          otpDeliveriesResults.push(sendEmailOtpResult);
        }
        if(fcmToken) {
          otpDeliveriesResults.push(sendPushOtpResult);
        }

        // Save the OTP code and its expiry time in the database for the user
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
          maxAttempts: CONFIG.OTP.AUTH.MAX_ATTEMPTS,
          requestIp: req.ip,
          createdAt: currentTime,
          otpDeliveries: otpDeliveriesResults || []
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
          push: pushOtpStatus,
          deliveryTargets: {
            email: emailOtpStatus && email ? CommonUtil.maskEmail(email) : null,
            mobile: smsOtpStatus && mobile ? CommonUtil.maskMobile(mobile) : null,
            push: pushOtpStatus,
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
