import usersRepository from '../repositories/users-report.repository';
import {
  CommonReportSortBy,
  CommonReportSorting,
  DesignationsReportResponse,
  ReportResponse,
  ReportScope,
  UserDetailsResponse,
  UserScopedReportPayload,
  GetUsersPayload,
  GetDesignationsPayload,
  GetRolesPayload,
  UsersReportResponse,
  RolesReportResponse,
} from '../types/report.types';
import { User, Designation, Role } from '../../../models/schemas';
import baseReportHelper from '../helpers/base-report.helper';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { CONFIG } from '../../../config/constants';
import roleRepository from '../repositories/role-report.repository';

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
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

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
}

export default new UserService();