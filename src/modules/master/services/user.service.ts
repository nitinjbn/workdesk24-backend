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
import { CONFIG } from '../../../config/constants';
import roleRepository from '../repositories/role-report.repository';
import { CommonUtil } from '../../../shared/utils/common.util';
import { PhoneUtil } from '../../../shared/utils/phone.util';

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

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
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
      
      return userData;
    });

    return {
      users: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getUserDetails(
    payload: { hostId: number, userId: number },
    scope: ReportScope
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
    return {
      user: formatDateTimeFieldsBySettings(userDetails, dateTimeSettings),
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
    const { hostId, name, employeeCode, email, enteredMobileNumber, mobile, password, reportingManagerId, designationId, profileImageUrl, joiningDate, gender, accountStatus, addressLine1, addressLine2, landmark, countryName, countryIsoCode, state, city, district, pinCode, timezone } = payload;

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
    const appUserRoleDetails = await roleRepository.getRoleByCode({
      roleCode:CONFIG.AUTH.APP.LOGIN.ALLOWED_ROLES[0],
      hostId
    });
    //console.log('############# appUserRoleDetails:', appUserRoleDetails);
    const roleId = appUserRoleDetails?.data?.id;
    if (!roleId) {
      throw new Error('Invalid role details');
    }

    const validationResult = PhoneUtil.validate(mobile, countryIsoCode);
    //console.log('############# Phone validation result:', validationResult);
    if (!validationResult.success) {
      throw new Error(validationResult.message || 'Invalid mobile number');
    }
    const callingCode = validationResult.countryCode || '';
    const normalizedMobile = validationResult.e164 || mobile;

    const createAppUserResult = await usersRepository.createAppUser({
      hostId,
      name,
      email,
      enteredMobileNumber,
      callingCode,
      mobile: normalizedMobile,
      password,
      employeeCode,
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
      state,
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

  async validateUserMobile(payload: { hostId: number, mobile: string }): Promise<any> {
    const { hostId, mobile } = payload;
    const userDetails = await usersRepository.getUsersByFilter({
      mobile,
      accountStatus: 'ACTIVE',
      isDeleted: 0
    });

    if (userDetails && userDetails.length > 0) {
      if (userDetails[0]?.hostId !== hostId) {
        throw createConfiguredError('MOBILE_NUMBER_LINKED_WITH_OTHER_HOST', 'Mobile number is linked with another host, please use a different mobile number.');
      }

      throw createConfiguredError('DUPLICATE_MOBILE_NUMBER', 'Mobile number already exists');
    }

    return {
      success: true
    };
  }
}

export default new UserService();