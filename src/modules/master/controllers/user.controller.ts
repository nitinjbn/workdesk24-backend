import { Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { GetUsersPayload } from '../types/master.types';
import userService from '../services/user.service';
import { uploadBufferToMediaStorage } from '../../../shared/utils/media-storage.util';
import { PhoneUtil } from '../../../shared/utils/phone.util';
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

  async createAppUser(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, name, email, employeeCode, mobile, dateOfBirth, gender, password, reportingManagerId, roleId, designationId, joiningDate, accountStatus, addressLine1, addressLine2, landmark, countryName, countryIsoCode, stateName, stateIsoCode, city, district, pinCode, timezone, settings } =  req.body;
      const file = req.file as Express.Multer.File | undefined;

      let profileImageUrl = "";
      if(file) {
        const result = await uploadBufferToMediaStorage(file, `${hostId}/users`);
        //console.log('####################### Media uploaded to Cloudinary:', result);
        profileImageUrl = result.url;
      }      

      // const validationResult = PhoneUtil.validate(mobile, countryIsoCode);
      // console.log('############# Phone validation result:', validationResult);
      // if (!validationResult.success) {
      //   res.status(400).json({
      //     success: false,
      //     message: validationResult.message,
      //   } as ApiResponse);
      //   return;
      // }
      // const callingCode = validationResult.countryCode || '';

      const createUserResult = await userService.createAppUser({
        hostId,
        name,
        email,
        employeeCode,
        gender,
        mobile,
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
      const { hostId, mobile, country: defaultCountry } = req.body;
      
      const validationResult = PhoneUtil.validate(mobile, defaultCountry);
      console.log('############# Phone validation result:', validationResult);
      if (!validationResult.success) {
        res.status(400).json({
          success: false,
          message: validationResult.message,
        } as ApiResponse);
        return;
      } else {

        // Check if the mobile number is globally unique across all hosts, otherwise throw an error
        await userService.validateUserMobile({
          hostId,
          mobile: validationResult.e164 || mobile
        });
        
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
      }
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
      if(!existingUser) {
        res.status(404).json({
          success: false,
          message: 'User not found.',
        } as ApiResponse);
        return;
      }

      let updateObj: any = {
        hostId,
        userId,
        name,
        email,
        employeeCode,
        gender,
        mobile,
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
}

export default new UserController();