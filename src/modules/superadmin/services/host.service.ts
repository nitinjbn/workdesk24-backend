import usersRepository from '../../master/repositories/users-report.repository';
import {
  CommonReportSortBy,
  CommonReportSorting,
  DesignationsReportResponse,
  ReportScope,
  UserDetailsResponse,
  UserScopedReportPayload,
  GetUsersPayload,
  GetDesignationsPayload,
  GetRolesPayload,
  UsersReportResponse,
  RolesReportResponse,
  SingleRecordResponse,
} from '../types/master.types';
import { User, Designation, Role } from '../../../models/schemas';
import baseReportHelper from '../helpers/base-report.helper';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import {
  DateTimeFormatUtil,
  formatDateTimeFieldsBySettings,
} from '../../../shared/utils/date-time-format.util';
import { formatStorageFieldsByConfig } from '../../../shared/utils/storage-format.util';
import { CONFIG } from '../../../config/constants';
import { sequelize } from '../../../models';
import hostsRepository from '../repositories/host.repository';
import { CommonUtil } from '../../../shared/utils/common.util';
import { PhoneUtil } from '../../../shared/utils/phone.util';
import userNotificationService from '../../notifications/master/userNotificationService';

type UserInstance = typeof User.prototype;
type DesignationInstance = typeof Designation.prototype;
type RoleInstance = typeof Role.prototype;
export class HostService {
  private normalizeCommonSorting(payload: UserScopedReportPayload): CommonReportSorting {
    const requestedSortBy = payload.sort?.by || payload.sortBy;
    const requestedSortOrder = payload.sort?.order || payload.sortOrder;

    const allowedSortBy: CommonReportSortBy[] = [
      'createdAt',
      'batteryPercentage',
      'speed',
      'userName',
    ];

    const sortBy = allowedSortBy.includes(requestedSortBy as any)
      ? (requestedSortBy as CommonReportSortBy)
      : 'createdAt';

    return {
      sortBy,
      sortOrder: baseReportHelper.normalizeSortDirection(requestedSortOrder),
    };
  }

  async createHost(payload: any): Promise<any> {
    const {
      companyName,
      contactPerson,
      companyLogoUrl,
      websiteUrl,
      email,
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
    } = payload;

    let subscription = payload.subscription;
    if (subscription && typeof subscription !== 'object') {
      subscription = CommonUtil.parseJsonField(subscription);
    }

    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    const transaction = await sequelize.transaction();

    try {
      // Create the host record in the database
      const createHostResult = await hostsRepository.createHost(
        {
          companyName,
          contactPerson,
          companyLogoUrl,
          websiteUrl,
          email,
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
          createdAt: currentUnixTime,
        },
        transaction
      );

      if (!createHostResult) {
        throw new Error('Failed to create host');
      }

      // Create an admin user for the newly created host
      const hostId = createHostResult.id;
      const createAdminUserResult = await hostsRepository.createAdminUser(
        {
          hostId,
          name: contactPerson,
          email,
          enteredMobileNumber: payload.enteredMobileNumber,
          callingCode: payload.callingCode,
          mobile,
          password,
          employeeCode: 'ADMIN',
          dateOfBirth: payload.dateOfBirth || null,
          profileImageUrl: companyLogoUrl,
          gender,
          accountStatus: 'ACTIVE',
          addressLine1,
          addressLine2,
          countryName,
          countryIsoCode,
          stateName,
          stateIsoCode,
          city,
          district,
          pinCode,
          timezone,
          isAdminUser: 1,
          createdAt: currentUnixTime,
        },
        transaction
      );

      if (!createAdminUserResult) {
        throw new Error('Failed to create admin user');
      }

      // Create host subscription for the newly created host
      const createHostSubscriptionResult = await hostsRepository.createHostSubscription(
        {
          hostId,
          ...subscription,
          isEnabled: 1,
          isDeleted: 0,
          createdAt: currentUnixTime,
        },
        transaction
      );

      if (!createHostSubscriptionResult) {
        throw new Error('Failed to create host subscription');
      }

      await transaction.commit();

      return {
        host: createHostResult,
        user: createAdminUserResult,
        subscription: createHostSubscriptionResult,
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  // async updateHost(payload: any): Promise<any> {
  //   const {
  //     hostId,
  //     userId,
  //     name,
  //     employeeCode,
  //     email,
  //     callingCode,
  //     enteredMobileNumber,
  //     mobile,
  //     dateOfBirth,
  //     password,
  //     reportingManagerId,
  //     designationId,
  //     profileImageUrl,
  //     joiningDate,
  //     gender,
  //     accountStatus,
  //     addressLine1,
  //     addressLine2,
  //     landmark,
  //     countryName,
  //     countryIsoCode,
  //     stateName,
  //     stateIsoCode,
  //     city,
  //     district,
  //     pinCode,
  //     timezone,
  //     holidayCalendarId,
  //     leavePolicyId,
  //     attendanceSites,
  //   } = payload;

  //   let settings = payload.settings;
  //   if (settings && typeof settings !== 'object') {
  //     settings = CommonUtil.parseJsonField(settings);

  //     // If weeklyOffDays is present, convert it to getWeeklyOffMask and remove weeklyOffDays
  //     if (settings?.weeklyOffDays) {
  //       settings.weeklyOffMask = DateTimeFormatUtil.getWeeklyOffMask(settings.weeklyOffDays);
  //       delete settings.weeklyOffDays;
  //     }
  //   }
  //   //console.log("#################################### settings after processing:", settings);

  //   const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

  //   // const validationResult = PhoneUtil.validate(mobile, countryIsoCode);
  //   // //console.log('############# Phone validation result:', validationResult);
  //   // if (!validationResult.success) {
  //   //   throw new Error(validationResult.message || 'Invalid mobile number');
  //   // }
  //   // const callingCode = validationResult.countryCode || '';
  //   // const normalizedMobile = validationResult.e164 || mobile;

  //   let updateObj: any = {
  //     name,
  //     email,
  //     enteredMobileNumber,
  //     callingCode,
  //     mobile,
  //     employeeCode,
  //     dateOfBirth,
  //     reportingManagerId,
  //     designationId,
  //     joiningDate,
  //     gender,
  //     accountStatus,
  //     addressLine1,
  //     addressLine2,
  //     landmark,
  //     countryName,
  //     countryIsoCode,
  //     stateName,
  //     stateIsoCode,
  //     city,
  //     district,
  //     pinCode,
  //     timezone,
  //     holidayCalendarId,
  //     leavePolicyId,
  //     updatedAt: currentUnixTime,
  //   };

  //   if (password) {
  //     updateObj.password = password;
  //   }

  //   if (profileImageUrl) {
  //     updateObj.profileImageUrl = profileImageUrl;
  //   }

  //   const updateAppUserResult = await usersRepository.updateAppUser(
  //     {
  //       ...updateObj,
  //     },
  //     { hostId, userId }
  //   );

  //   //console.log("###################### updateAppUserResult:", updateAppUserResult);

  //   if (!updateAppUserResult) {
  //     throw new Error('Failed to update app user');
  //   }

  //   // Update user settings
  //   const updateUserSettingsResult = await usersRepository.updateUserSettings({
  //     userId: updateAppUserResult.id,
  //     settings: CommonUtil.convertSettingsToArray(settings),
  //     updatedAt: currentUnixTime,
  //   });

  //   // Update attendance locations
  //   await usersRepository.updateUserAttendanceSites({
  //     userId: updateAppUserResult.id,
  //     attendanceSites,
  //     updatedAt: currentUnixTime,
  //   });

  //   // Notify user app to refresh settings if the user has an active FCM token.
  //   try {
  //     const updatedUserDetails = await usersRepository.getUserById({
  //       hostId,
  //       userId: updateAppUserResult.id,
  //     });
  //     //console.log("###################### updatedUserDetails:", updatedUserDetails);

  //     const fcmToken = updatedUserDetails?.device?.fcmToken?.trim();
  //     const deviceId = updatedUserDetails?.device?.deviceId?.trim();
  //     //console.log("###################### fcmToken:", fcmToken);
  //     if (fcmToken && deviceId) {
  //       const notificationResult = await userNotificationService.syncUserSettings({
  //         hostId,
  //         userId: updateAppUserResult.id,
  //         deviceId,
  //         fcmToken,
  //       });
  //       //console.log("###################### notificationResult:", notificationResult);
  //     }
  //   } catch (notificationError: any) {
  //     console.error(
  //       'Failed to send user settings sync notification:',
  //       notificationError?.message || notificationError
  //     );
  //   }

  //   return { user: updateAppUserResult, settings: updateUserSettingsResult };
  // }

  async validateUserEmail(payload: { hostId: number; email: string }): Promise<any> {
    const { hostId, email } = payload;
    const userDetails = await usersRepository.getUsersByFilter({
      email,
      accountStatus: 'ACTIVE',
      isDeleted: 0,
    });
    //console.log("###################### userDetails for email validation:", userDetails);

    if (userDetails && userDetails.length > 0) {
      if (userDetails[0]?.hostId != hostId) {
        throw createConfiguredError(
          'EMAIL_LINKED_WITH_OTHER_HOST',
          'Email is linked with another host, please use a different email.'
        );
      }

      throw createConfiguredError('DUPLICATE_EMAIL', 'Email already exists');
    }

    return {
      success: true,
    };
  }
}

export default new HostService();
