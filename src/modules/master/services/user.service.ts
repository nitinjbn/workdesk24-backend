import usersRepository from '../repositories/users-report.repository';
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
import { DateTimeFormatUtil, formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { formatStorageFieldsByConfig } from '../../../shared/utils/storage-format.util';
import { CONFIG } from '../../../config/constants';
import roleRepository from '../repositories/role-report.repository';
import { CommonUtil } from '../../../shared/utils/common.util';
import { PhoneUtil } from '../../../shared/utils/phone.util';
import userNotificationService from '../../notifications/master/userNotificationService';

type UserInstance = typeof User.prototype;
type DesignationInstance = typeof Designation.prototype;
type RoleInstance = typeof Role.prototype;
export class UserService {
  async getAppUsers(
    payload: GetUsersPayload,
    scope: ReportScope
  ): Promise<UsersReportResponse<UserInstance>> {
    //const { page, limit } = baseReportHelper.normalizePagination(payload);
    const sorting = this.normalizeCommonSorting(payload as any);
    let { hostId, filter, page, limit } = payload;
    filter = {
      ...filter,
      roleCode: CONFIG.AUTH.APP.LOGIN.ALLOWED_ROLES
    }

    const report = await usersRepository.getUsers({
      hostId,
      page,
      limit,
      filter,
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder,
    });
    //console.log("#################################### report:", report);

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    //console.log("#################################### dateTimeSettings:", dateTimeSettings);
    const plainData = report.data.map((item: any) => {
      const userData = item && typeof item.toJSON === 'function' ? item.toJSON() : item;
      // Convert settings array to key-value object
      if (userData.settings && Array.isArray(userData.settings)) {
        userData.settings = CommonUtil.convertSettingsToObject(userData.settings);

        // If weeklyOffMask is present, convert it to weeklyOffDays and remove weeklyOffMask
        if(userData.settings?.weeklyOffMask) {
          userData.settings.weeklyOffDays = DateTimeFormatUtil.getWeeklyOffDays(userData.settings.weeklyOffMask);
          delete userData.settings.weeklyOffMask;
        }
      }
      //Change display name of gender
      userData.gender = CONFIG.USER.GENDER[userData.gender]
      
      return userData;
    });
    //console.log("#################################### plainData after processing:", plainData);

    // Format datetime fields first, then storage fields
    const formattedByDateTime = formatDateTimeFieldsBySettings(plainData, dateTimeSettings);
    const users = formatStorageFieldsByConfig(formattedByDateTime);

    return {
      users,
      pagination: report.pagination,
    };
  }

  async getUserDetails(
    payload: { hostId: number, userId: number },
    scope?: ReportScope
  ): Promise<UserDetailsResponse<UserInstance>> {
    let { hostId, userId } = payload;

    const userDetails = await usersRepository.getUserById({
      hostId,
      userId
    });

    // Convert settings array to key-value object
    if (userDetails.settings && Array.isArray(userDetails.settings)) {
      userDetails.settings = CommonUtil.convertSettingsToObject(userDetails.settings);

      // If weeklyOffMask is present, convert it to weeklyOffDays and remove weeklyOffMask
      if(userDetails.settings?.weeklyOffMask) {
        userDetails.settings.weeklyOffDays = DateTimeFormatUtil.getWeeklyOffDays(userDetails.settings.weeklyOffMask);
        delete userDetails.settings.weeklyOffMask;
      }
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    
    // Format datetime fields first, then storage fields
    const formattedByDateTime = formatDateTimeFieldsBySettings(userDetails, dateTimeSettings);
    const user = formatStorageFieldsByConfig(formattedByDateTime);
    
    return {
      user,
    };
  }

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

  async getDesignations(
    payload: GetDesignationsPayload,
    scope: ReportScope
  ): Promise<DesignationsReportResponse<DesignationInstance>> {
    //const { page, limit } = baseReportHelper.normalizePagination(payload);
    const sorting = this.normalizeCommonSorting(payload as any);
    let { hostId, filter, page, limit } = payload;
    
    const designations = await usersRepository.getDesignations({
      hostId,
      page,
      limit,
      filter,
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder,
    });  

    return {
      designations: designations.data,
      pagination: designations.pagination,
    };
  }
  
  async getRoles(
    payload: GetRolesPayload,
    scope: ReportScope
  ): Promise<RolesReportResponse<RoleInstance>> {
    //const { page, limit } = baseReportHelper.normalizePagination(payload);
    const sorting = this.normalizeCommonSorting(payload as any);
    let { hostId, filter, page, limit } = payload;
    
    const roles = await roleRepository.getRoles({
      hostId,
      page,
      limit,
      filter,
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder,
    });  

    return {
      roles: roles.data,
      pagination: roles.pagination,
    };
  }

  async getRoleDetailsById(
    payload: { hostId: number, roleId: number },
    scope: ReportScope
  ): Promise<any> {
    let { hostId, roleId } = payload;
    const roleDetails = await roleRepository.getRoleById({
      roleId,
      hostId
    });
    return {
      role: roleDetails.data,
    };
  }

  async getRoleDetailsByCode(
    payload: { hostId: number, roleCode: string },
    scope: ReportScope
  ): Promise<any> {
    let { hostId, roleCode } = payload;
    const roleDetails = await roleRepository.getRoleByCode({
      roleCode,
      hostId
    });
    return {
      role: roleDetails.data,
    };
  }

  async createAppUser(payload: any): Promise<any> {
    const { hostId, name, employeeCode, email, callingCode, enteredMobileNumber, mobile, dateOfBirth, password, reportingManagerId, roleId, designationId, profileImageUrl, joiningDate, gender, accountStatus, addressLine1, addressLine2, landmark, countryName, countryIsoCode, stateName, stateIsoCode, city, district, pinCode, timezone } = payload;

    let settings = payload.settings;
    if(settings && typeof settings !== 'object') {
      settings = CommonUtil.parseJsonField(settings);

      // If weeklyOffDays is present, convert it to getWeeklyOffMask and remove weeklyOffDays
      if(settings?.weeklyOffDays) {
        settings.weeklyOffMask = DateTimeFormatUtil.getWeeklyOffMask(settings.weeklyOffDays);
        delete settings.weeklyOffDays;
      }
    }
    //console.log("#################################### settings after processing:", settings);

    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();
    // const appUserRoleDetails = await roleRepository.getRoleByCode({
    //   roleCode:CONFIG.AUTH.APP.LOGIN.ALLOWED_ROLES[0],
    //   hostId
    // });
    // //console.log('############# appUserRoleDetails:', appUserRoleDetails);
    // const roleId = appUserRoleDetails?.data?.id;
    // if (!roleId) {
    //   throw new Error('Invalid role details');
    // }

    /*
    const validationResult = PhoneUtil.validate(mobile, countryIsoCode);
    //console.log('############# Phone validation result:', validationResult);
    if (!validationResult.success) {
      throw new Error(validationResult.message || 'Invalid mobile number');
    }
    const callingCode = validationResult.countryCode || '';
    const normalizedMobile = validationResult.e164 || mobile;
    */

    const createAppUserResult = await usersRepository.createAppUser({
      hostId,
      name,
      email,
      enteredMobileNumber,
      callingCode,
      mobile,
      password,
      employeeCode,
      dateOfBirth,
      roleId,
      reportingManagerId,
      designationId,
      profileImageUrl,
      joiningDate,
      gender,
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
      createdAt: currentUnixTime
    });

    if (!createAppUserResult) {
      throw new Error('Failed to create app user');
    }

    const createUserSettingsResult = await usersRepository.createUserSettings({
      userId: createAppUserResult.id,
      settings: CommonUtil.convertSettingsToArray(settings),
      createdAt: currentUnixTime
    });

    return { user: createAppUserResult, settings: createUserSettingsResult };
  }

  async validateUserMobile(payload: { hostId: number, mobile: string, userId?: number }): Promise<any> {
    const { hostId, mobile, userId } = payload;
    const userDetails = await usersRepository.getUsersByFilter({
      mobile,
      accountStatus: 'ACTIVE',
      isDeleted: 0
    });

    const duplicateUsers = (userDetails || []).filter((user: any) => !userId || Number(user.id) !== Number(userId));

    if (duplicateUsers.length > 0) {
      if (duplicateUsers[0]?.hostId != hostId) {
        throw createConfiguredError('MOBILE_NUMBER_LINKED_WITH_OTHER_HOST', 'Mobile number is linked with another host, please use a different mobile number.');
      }

      throw createConfiguredError('DUPLICATE_MOBILE_NUMBER', 'Mobile number already exists');
    }

    return {
      success: true
    };
  }

  async updateAppUser(payload: any): Promise<any> {
    const { hostId, userId, name, employeeCode, email, callingCode, enteredMobileNumber, mobile, dateOfBirth, password, reportingManagerId, designationId, profileImageUrl, joiningDate, gender, accountStatus, addressLine1, addressLine2, landmark, countryName, countryIsoCode, stateName, stateIsoCode, city, district, pinCode, timezone } = payload;

    let settings = payload.settings;
    if(settings && typeof settings !== 'object') {
      settings = CommonUtil.parseJsonField(settings);

      // If weeklyOffDays is present, convert it to getWeeklyOffMask and remove weeklyOffDays
      if(settings?.weeklyOffDays) {
        settings.weeklyOffMask = DateTimeFormatUtil.getWeeklyOffMask(settings.weeklyOffDays);
        delete settings.weeklyOffDays;
      }
    }
    //console.log("#################################### settings after processing:", settings);

    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();
   
    // const validationResult = PhoneUtil.validate(mobile, countryIsoCode);
    // //console.log('############# Phone validation result:', validationResult);
    // if (!validationResult.success) {
    //   throw new Error(validationResult.message || 'Invalid mobile number');
    // }
    // const callingCode = validationResult.countryCode || '';
    // const normalizedMobile = validationResult.e164 || mobile;

    let updateObj: any = {
      name,
      email,
      enteredMobileNumber,
      callingCode,
      mobile,
      employeeCode,
      dateOfBirth,
      reportingManagerId,
      designationId,
      joiningDate,
      gender,
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
      updatedAt: currentUnixTime
    };

    if(password) {
      updateObj.password = password;
    }

    if(profileImageUrl) {
      updateObj.profileImageUrl = profileImageUrl;
    }

    const updateAppUserResult = await usersRepository.updateAppUser({
      ...updateObj
    }, {hostId, userId});

    //console.log("###################### updateAppUserResult:", updateAppUserResult);

    if (!updateAppUserResult) {
      throw new Error('Failed to update app user');
    }

    // Update user settings
    const updateUserSettingsResult = await usersRepository.updateUserSettings({
      userId: updateAppUserResult.id,
      settings: CommonUtil.convertSettingsToArray(settings),
      updatedAt: currentUnixTime
    });

    // Notify user app to refresh settings if the user has an active FCM token.
    try {
      const updatedUserDetails = await usersRepository.getUserById({
        hostId,
        userId: updateAppUserResult.id,
      });
      //console.log("###################### updatedUserDetails:", updatedUserDetails);

      const fcmToken = updatedUserDetails?.device?.fcmToken?.trim();
      const deviceId = updatedUserDetails?.device?.deviceId?.trim();
      //console.log("###################### fcmToken:", fcmToken);
      if (fcmToken && deviceId) {
        const notificationResult = await userNotificationService.syncUserSettings({
          hostId,
          userId: updateAppUserResult.id,
          deviceId,
          fcmToken,
        });
        //console.log("###################### notificationResult:", notificationResult);
      }
    } catch (notificationError: any) {
      console.error('Failed to send user settings sync notification:', notificationError?.message || notificationError);
    }

    

    return { user: updateAppUserResult, settings: updateUserSettingsResult };
  }

  async deleteAppUser(payload: any): Promise<any> {
    const { hostId, userId } = payload;    
    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();
   
    let updateObj: any = {
      isDeleted: 1,
      deletedAt: currentUnixTime
    };
    
    const deleteAppUserResult = await usersRepository.updateAppUser({
      ...updateObj
    }, {hostId, userId});

    //console.log("###################### deleteAppUserResult:", deleteAppUserResult);

    if (!deleteAppUserResult) {
      throw new Error('Failed to delete app user');
    }

    return { user: deleteAppUserResult };
  }

  async validateUserEmail(payload: { hostId: number, email: string }): Promise<any> {
    const { hostId, email } = payload;
    const userDetails = await usersRepository.getUsersByFilter({
      email,
      accountStatus: 'ACTIVE',
      isDeleted: 0
    });
    //console.log("###################### userDetails for email validation:", userDetails);

    if (userDetails && userDetails.length > 0) {
      if (userDetails[0]?.hostId != hostId) {
        throw createConfiguredError('EMAIL_LINKED_WITH_OTHER_HOST', 'Email is linked with another host, please use a different email.');
      }

      throw createConfiguredError('DUPLICATE_EMAIL', 'Email already exists');
    }

    return {
      success: true
    };
  }

  async getRoleByCode(payload: { hostId: number, roleCode: string }): Promise<any> {
    const { hostId, roleCode } = payload;
    const roleDetails = await roleRepository.getRoleByCode({
      roleCode,
      hostId
    });
    return {
      role: roleDetails.data,
    };
  }

  async getUsersByFilter(payload: { hostId: number, filter: any }): Promise<any> {
    const { hostId, filter } = payload;
    const users = await usersRepository.getUsersByFilter({
      ...filter,
      hostId
    });
    return {
      users: users,
    };
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
      await usersRepository.updateUserDeviceDetails(payload);
    }
}

export default new UserService();