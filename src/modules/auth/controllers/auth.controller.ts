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
      let { identifier } = req.body;
      identifier = identifier?.trim(); // Trim whitespace from the identifier

      // Validate the identifier exists and is not empty
      if (!identifier) {
        res.status(400).json({
          success: false,
          message: 'Please enter email or mobile number.',
        } as ApiResponse);
        return;
      }
      
      // Determine if the identifier is an email or mobile number
      const parseIdentifierResult = CommonUtil.parseIdentifier(identifier);
      if (!parseIdentifierResult.type) {
        res.status(400).json({
          success: false,
          message: 'Invalid value. Must be a valid email or phone number.',
        } as ApiResponse);
        return;
      }

      let whereClause: Record<string, any> = {
        accountStatus: 'ACTIVE',
        isDeleted: 0
      };

      if (parseIdentifierResult.type === 'EMAIL') {
        whereClause.email = parseIdentifierResult.email;
      } else if (parseIdentifierResult.type === 'MOBILE') {
        whereClause.mobile = parseIdentifierResult.mobile;
      }

      const getUsersResult = await authService.getUsersByFilter(whereClause);
      //console.log("################ AuthController.requestOtp: Users fetched by filter:", getUsersResult);
      const users = getUsersResult.users || [];

      if (!users || users.length === 0) {
        res.status(404).json({
          success: false,
          message: 'You are not registered. Please contact your administrator.',
        } as ApiResponse);
        return;
      }

      if(users.length > 1) {
        res.status(400).json({
          success: false,
          message: 'Multiple users found with the same identifier. Please contact your administrator.',
        } as ApiResponse);
        return;
      }

      const user = users[0];
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
          token: result.token,
          permissions: result.permissionsByModule,
        },
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }
}

export default new AuthController();
