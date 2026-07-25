import { Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { GetUsersPayload } from '../types/master.types';
import userService from '../services/user.service';
import { uploadBufferToMediaStorage } from '../../../shared/utils/media-storage.util';
import { PhoneUtil } from '../../../shared/utils/phone.util';
import { EmailUtil } from '../../../shared/utils/email.util';
import { CONFIG } from '../../../config/constants';
export class UserController {

  async getAppUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getAppUsers(payload as GetUsersPayload, scope),
      'Users retrieved successfully'
    );
  }

  async getUserDetails(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getUserDetails(payload as any, scope),
      'User details retrieved successfully'
    );
  }

  async getDesignations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getDesignations(payload as any, scope),
      'Designations retrieved successfully'
    );
  }

  async getRoles(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getRoles(payload as any, scope),
      'Roles retrieved successfully'
    );
  }

  async getRoleDetailsById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getRoleDetailsById(payload as any, scope),
      'Role details retrieved successfully'
    );
  }

  async getRoleDetailsByCode(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    await this.executeUserScopedReport(
      req,
      res,
      next,
      (payload, scope) => userService.getRoleDetailsByCode(payload as any, scope),
      'Role details retrieved successfully'
    );
  }

  private async validateEmail(payload:{email: string, hostId: number, userId?: number}): Promise<any> {
    const { email, hostId, userId } = payload;
    const emailValidationResult = await EmailUtil.validate(email, {
      checkMx: true,
      checkDisposable: true
    });
    if (!emailValidationResult.isValid) {
      throw new Error(emailValidationResult.error || 'Invalid email address');
    }

    // Check if the email is globally unique across all hosts, otherwise throw an error
    const userDetails = await userService.getUsersByFilter({hostId, filter: { email: emailValidationResult.email, accountStatus: 'ACTIVE', isDeleted: 0 }});
    const duplicateUsers = (userDetails?.users || []).filter((user: any) => !userId || Number(user.id) !== Number(userId));
    if (duplicateUsers.length > 0) {
      if (duplicateUsers[0]?.hostId != hostId) {
        throw new Error('Email is linked with another host, please use a different email.');
      }

      throw new Error('Email already exists');
    }
    return {
      isValid: true,
      email: emailValidationResult.email,
      localPart: emailValidationResult.localPart,
      domain: emailValidationResult.domain
    }
  }

  private async validateMobile(payload:{hostId: number, mobile: string, countryIsoCode: "IN" | "US", userId?: number}): Promise<any> {
    const { hostId, mobile, countryIsoCode, userId } = payload;
      
      const validationResult = PhoneUtil.validate(mobile, countryIsoCode);
      //console.log('############# Phone validation result:', validationResult);
      if (!validationResult.success) {
        throw new Error(validationResult.message || 'Invalid mobile number');
      } else {
        // Check if the mobile number is globally unique across all hosts, otherwise throw an error
        await userService.validateUserMobile({
          hostId,
          mobile: validationResult.e164 || mobile,
          userId
        });

        return {
          isValid: true,
          e164: validationResult.e164,
          country: validationResult.country,
          countryCode: validationResult.countryCode,
          nationalNumber: validationResult.nationalNumber,
          international: validationResult.international,
          national: validationResult.national,
          type: validationResult.type
        }
      }
  }

  async createAppUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, name, email, employeeCode, mobile, dateOfBirth, gender, password, reportingManagerId, designationId, joiningDate, accountStatus, addressLine1, addressLine2, landmark, countryName, countryIsoCode, stateName, stateIsoCode, city, district, pinCode, timezone, settings } =  req.body;
      const file = req.file as Express.Multer.File | undefined;

      //Step 1: Validate the mobile number uniqueness and format using PhoneUtil
      const mobileValidationResult = await this.validateMobile({ hostId, mobile, countryIsoCode });
      if (!mobileValidationResult.isValid) {
        throw new Error('Invalid mobile number');
      }
      const callingCode = mobileValidationResult.countryCode || '';
      const normalizedMobile = mobileValidationResult.e164 || mobile;

      //Step 2: Validate the email uniqueness and format using EmailUtil
      const emailValidationResult = await this.validateEmail({ email, hostId });
      if (!emailValidationResult.isValid) {
        throw new Error('Invalid email address');
      }

      //Step 3: Check if the email is globally unique across all hosts, otherwise throw an error
      const appUserRoleDetails = await userService.getRoleByCode({
        roleCode:CONFIG.AUTH.APP.LOGIN.ALLOWED_ROLES[0],
        hostId
      });
      const roleId = appUserRoleDetails?.role?.id;
      if (!roleId) {
        throw new Error('Invalid role details');
      }

      //Step 4: Upload the profile image to media storage if provided
      let profileImageUrl = "";
      if(file) {
        const result = await uploadBufferToMediaStorage(file, `${hostId}/users`);
        //console.log('####################### Media uploaded to Cloudinary:', result);
        profileImageUrl = result.url;
      }

      const createUserResult = await userService.createAppUser({
        hostId,
        name,
        email: emailValidationResult.email,
        employeeCode,
        gender,
        callingCode,
        mobile: normalizedMobile,
        enteredMobileNumber: mobile,
        password,
        dateOfBirth,
        reportingManagerId,
        roleId,
        designationId,
        profileImageUrl,
        joiningDate,
        accountStatus,
        addressLine1,
        addressLine2,
        landmark,
        countryName,
        countryIsoCode,
        stateName,
        stateIsoCode,
        city,
        district,
        pinCode,
        timezone,
        settings
      });
      //console.log('####################### createUserResult:', createUserResult);

      res.json({
        success: true,
        message: 'User created successfully',
        data: {
          userId: createUserResult.user.id
        },
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error creating user',
        error: error.message,
      } as ApiResponse);
    }
  }

  private async executeUserScopedReport(
    req: AuthRequest,
    res: Response,
    next: NextFunction,
    handler: (payload: Record<string, unknown>, scope: { hostId: number; requestUserId?: number }) => Promise<unknown>,
    successMessage: string,
    restrictToSelf = false
  ): Promise<void> {
    try {
      const result = await handler(req.body as Record<string, unknown>, {
        hostId: req.user!.hostId,
        requestUserId: restrictToSelf ? req.user!.id : undefined,
      });

      res.json({
        success: true,
        message: successMessage,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async validateUserMobile(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, mobile, country: defaultCountry, userId } = req.body;
      const validationResult = await this.validateMobile({ hostId, mobile, countryIsoCode: defaultCountry, userId });
      
      if (!validationResult.isValid) {
        throw new Error('Invalid mobile number');
      }

      res.json({
        success: true,
        message: 'Mobile number is valid.',
        data: {
          e164: validationResult.e164,
          country: validationResult.country,
          countryCode: validationResult.countryCode,
          nationalNumber: validationResult.nationalNumber,
          international: validationResult.international,
          national: validationResult.national,
          type: validationResult.type
        }
      } as ApiResponse);

    } catch (error: any) {
      next(error);
    }
  }

  async updateAppUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, userId, name, email, employeeCode, mobile, dateOfBirth, gender, password, profileImageUrl, reportingManagerId, roleId, designationId, joiningDate, accountStatus, addressLine1, addressLine2, landmark, countryName, countryIsoCode, stateName, stateIsoCode, city, district, pinCode, timezone, settings } =  req.body;
      const file = req.file as Express.Multer.File | undefined;

      if(!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required for updating user.',
        } as ApiResponse);
        return;
      }

      const existingUser = await userService.getUserDetails({ userId, hostId });
      if(Object.keys(existingUser.user).length === 0) {
        res.status(404).json({
          success: false,
          message: 'User not found.',
        } as ApiResponse);
        return;
      }

      //Step 1: Validate the mobile number uniqueness and format using PhoneUtil
      const mobileValidationResult = await this.validateMobile({ hostId, mobile, countryIsoCode, userId: Number(userId) });
      if (!mobileValidationResult.isValid) {
        throw new Error('Invalid mobile number');
      }
      const callingCode = mobileValidationResult.countryCode || '';
      const normalizedMobile = mobileValidationResult.e164 || mobile;

      //Step 2: Validate the email uniqueness and format using EmailUtil
      const emailValidationResult = await this.validateEmail({ email, hostId, userId: Number(userId) });
      if (!emailValidationResult.isValid) {
        throw new Error('Invalid email address');
      }

      let updateObj: any = {
        hostId,
        userId,
        name,
        email: emailValidationResult.email,
        employeeCode,
        gender,
        callingCode,
        mobile: normalizedMobile,
        enteredMobileNumber: mobile,
        dateOfBirth,
        profileImageUrl,
        reportingManagerId,
        roleId,
        designationId,
        joiningDate,
        accountStatus,
        addressLine1,
        addressLine2,
        landmark,
        countryName,
        countryIsoCode,
        stateName,
        stateIsoCode,
        city,
        district,
        pinCode,
        timezone,
        settings
      };

      // Update password only if it's provided in the request
      if(password && password.trim() !== 'NOCHANGE') {
        updateObj.password = password;
      }
      
      // Update profile image only if a new file is provided
      if(file) {
        const result = await uploadBufferToMediaStorage(file, `${hostId}/users`);
        //console.log('####################### Media uploaded to Cloudinary:', result);
        updateObj.profileImageUrl = result.url;
      }      

      //// Update the user using the service
      const updateUserResult = await userService.updateAppUser({
        ...updateObj
      });
      
      res.json({
        success: true,
        message: 'User updated successfully',
        data: {
          userId: updateUserResult.user.id
        },
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async deleteAppUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, userId } = req.body;

      if(!userId) {
        res.status(400).json({
          success: false,
          message: 'User ID is required for deleting user.',
        } as ApiResponse);
        return;
      }

      const existingUser = await userService.getUserDetails({ userId, hostId });
      //console.log('###################### existingUser:', existingUser);
      if(Object.keys(existingUser.user).length === 0) {
        res.status(404).json({
          success: false,
          message: 'User not found.',
        } as ApiResponse);
        return;
      }

      let updateObj: any = {
        hostId,
        userId
      };      

      //// Soft delete the user using the service
      const deleteUserResult = await userService.deleteAppUser({
        ...updateObj
      });
      
      res.json({
        success: true,
        message: 'User deleted successfully',
        data: {
          userId: deleteUserResult.user.id
        },
      } as ApiResponse);
    } catch (error: any) {
      next(error);
    }
  }

  async validateUserEmail(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, email, userId } = req.body;
      const validationResult = await this.validateEmail({ email, hostId, userId });
      
      if (validationResult.isValid) {
        res.json({
          success: true,
          message: 'Email is valid.',
          data: {
            email: validationResult.email,
            localPart: validationResult.localPart,
            domain: validationResult.domain
          }
        } as ApiResponse);
      }
    } catch (error: any) {
      next(error);
    }
  }

  async updateFcmToken(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, userId, deviceId, fcmToken } = req.body;

      if (!hostId || !userId || !deviceId || !fcmToken) {
        res.status(400).json({
          success: false,
          message: 'hostId, userId, deviceId, and fcmToken are required',
        } as ApiResponse);
        return;
      }

      await userService.updateUserDeviceDetails({
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

export default new UserController();