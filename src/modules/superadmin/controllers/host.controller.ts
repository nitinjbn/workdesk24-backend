import { Response, NextFunction } from 'express';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import { uploadBufferToMediaStorage } from '../../../shared/utils/media-storage.util';
import { PhoneUtil } from '../../../shared/utils/phone.util';
import { EmailUtil } from '../../../shared/utils/email.util';
import { CONFIG } from '../../../config/constants';
import UserValidator from '../helpers/user.validator';
import { createConfiguredError } from '../../../shared/utils/error.util';
import hostService from '../services/host.service';

export class HostController {
  private async validateEmail(payload: { email: string; userId?: number }): Promise<any> {
    const { email } = payload;
    const emailValidationResult = await EmailUtil.validate(email, {
      checkMx: true,
      checkDisposable: true,
    });
    if (!emailValidationResult.isValid) {
      throw new Error(emailValidationResult.error || 'Invalid email address');
    }

    return {
      isValid: true,
      email: emailValidationResult.email,
      localPart: emailValidationResult.localPart,
      domain: emailValidationResult.domain,
    };
  }

  private async validateMobile(payload: {
    mobile: string;
    countryIsoCode: 'IN' | 'US';
    userId?: number;
  }): Promise<any> {
    const { mobile, countryIsoCode, userId } = payload;

    const validationResult = PhoneUtil.validate(mobile, countryIsoCode);
    //console.log('############# Phone validation result:', validationResult);
    if (!validationResult.success) {
      throw new Error(validationResult.message || 'Invalid mobile number');
    }
    return {
      isValid: true,
      e164: validationResult.e164,
      country: validationResult.country,
      countryCode: validationResult.countryCode,
      nationalNumber: validationResult.nationalNumber,
      international: validationResult.international,
      national: validationResult.national,
      type: validationResult.type,
    };
  }

  async createHost(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const {
        companyName,
        contactPerson,
        websiteUrl,
        email,
        employeeCode,
        mobile,
        gender,
        password,
        addressLine1,
        addressLine2,
        countryName,
        countryIsoCode,
        stateName,
        stateIsoCode,
        city,
        district,
        pinCode,
        latitude,
        longitude,
        gstNumber,
        panNumber,
        timezone,
        subscription,
      } = req.body;

      console.log('Creating host with payload:', req.body);

      // Check if the host is eligible to create an app user, this will throw an error if not eligible
      //await UserValidator.checkCreateAppUserEligibility(hostId);

      const file = req.file as Express.Multer.File | undefined;

      //Step 1: Validate the mobile number uniqueness and format using PhoneUtil
      const mobileValidationResult = await this.validateMobile({ mobile, countryIsoCode });
      if (!mobileValidationResult.isValid) {
        throw new Error('Invalid mobile number');
      }
      const callingCode = mobileValidationResult.countryCode || '';
      const normalizedMobile = mobileValidationResult.e164 || mobile;

      //Step 2: Validate the email uniqueness and format using EmailUtil
      const emailValidationResult = await this.validateEmail({ email });
      if (!emailValidationResult.isValid) {
        throw new Error('Invalid email address');
      }

      //Step 4: Upload the profile image to media storage if provided
      let companyLogoUrl = '';
      if (file) {
        const result = await uploadBufferToMediaStorage(
          file,
          `hosts/${companyName.replace(/\s+/g, '_')}`
        );
        //console.log('####################### Media uploaded to Cloudinary:', result);
        companyLogoUrl = result.url;
      }

      const createUserResult = await hostService.createHost({
        companyName,
        companyLogoUrl,
        websiteUrl,
        contactPerson,
        email: emailValidationResult.email,
        password,
        employeeCode,
        gender,
        callingCode,
        mobile: normalizedMobile,
        enteredMobileNumber: mobile,
        addressLine1,
        addressLine2,
        city,
        stateName,
        stateIsoCode,
        pinCode,
        countryName,
        countryIsoCode,
        district,
        latitude,
        longitude,
        gstNumber,
        panNumber,
        timezone,
        subscription,
      });
      //console.log('####################### createUserResult:', createUserResult);

      res.json({
        success: true,
        message: 'Host created successfully',
        data: {
          hostId: createUserResult.host.id,
        },
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error creating host',
        error: error.message,
      } as ApiResponse);
    }
  }

  // async updateHost(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
  //   try {
  //     const {
  //       hostId,
  //       userId,
  //       name,
  //       email,
  //       employeeCode,
  //       mobile,
  //       dateOfBirth,
  //       gender,
  //       password,
  //       profileImageUrl,
  //       reportingManagerId,
  //       roleId,
  //       designationId,
  //       joiningDate,
  //       accountStatus,
  //       addressLine1,
  //       addressLine2,
  //       landmark,
  //       countryName,
  //       countryIsoCode,
  //       stateName,
  //       stateIsoCode,
  //       city,
  //       district,
  //       pinCode,
  //       timezone,
  //       settings,
  //       holidayCalendarId,
  //       leavePolicyId,
  //       attendanceSites,
  //     } = req.body;
  //     const file = req.file as Express.Multer.File | undefined;

  //     if (!userId) {
  //       res.status(400).json({
  //         success: false,
  //         message: 'User ID is required for updating user.',
  //       } as ApiResponse);
  //       return;
  //     }

  //     const existingUser = await hostService.getHostDetails({ userId, hostId });
  //     if (Object.keys(existingUser.user).length === 0) {
  //       res.status(404).json({
  //         success: false,
  //         message: 'User not found.',
  //       } as ApiResponse);
  //       return;
  //     }

  //     //Step 1: Validate the mobile number uniqueness and format using PhoneUtil
  //     const mobileValidationResult = await this.validateMobile({
  //       mobile,
  //       countryIsoCode,
  //     });
  //     if (!mobileValidationResult.isValid) {
  //       throw new Error('Invalid mobile number');
  //     }
  //     const callingCode = mobileValidationResult.countryCode || '';
  //     const normalizedMobile = mobileValidationResult.e164 || mobile;

  //     //Step 2: Validate the email uniqueness and format using EmailUtil
  //     const emailValidationResult = await this.validateEmail({
  //       email,
  //     });
  //     if (!emailValidationResult.isValid) {
  //       throw new Error('Invalid email address');
  //     }

  //     let updateObj: any = {
  //       hostId,
  //       userId,
  //       name,
  //       email: emailValidationResult.email,
  //       employeeCode,
  //       gender,
  //       callingCode,
  //       mobile: normalizedMobile,
  //       enteredMobileNumber: mobile,
  //       dateOfBirth,
  //       profileImageUrl,
  //       reportingManagerId,
  //       roleId,
  //       designationId,
  //       joiningDate,
  //       accountStatus,
  //       addressLine1,
  //       addressLine2,
  //       landmark,
  //       countryName,
  //       countryIsoCode,
  //       stateName,
  //       stateIsoCode,
  //       city,
  //       district,
  //       pinCode,
  //       attendanceSites,
  //       timezone,
  //       holidayCalendarId,
  //       leavePolicyId,
  //       settings,
  //     };

  //     // Update password only if it's provided in the request
  //     if (password && password.trim() !== 'NOCHANGE') {
  //       updateObj.password = password;
  //     }

  //     // Update profile image only if a new file is provided
  //     if (file) {
  //       const result = await uploadBufferToMediaStorage(file, `${hostId}/users`);
  //       //console.log('####################### Media uploaded to Cloudinary:', result);
  //       updateObj.profileImageUrl = result.url;
  //     }

  //     //// Update the user using the service
  //     const updateUserResult = await hostService.updateHost({
  //       ...updateObj,
  //     });

  //     res.json({
  //       success: true,
  //       message: 'Host updated successfully',
  //       data: {
  //         hostId: updateUserResult.host.id,
  //       },
  //     } as ApiResponse);
  //   } catch (error: any) {
  //     next(error);
  //   }
  // }
}

export default new HostController();
