import usersRepository from '../repositories/users-report.repository';
import {
  CommonReportSortBy,
  CommonReportSorting,
  ReportResponse,
  ReportScope,
  UserScopedReportFilter,
  UserScopedReportPayload,
  GetUsersPayload,
  SingleRecordResponse
} from '../types/report.types';
import { User } from '../../../models/schemas';
import baseReportHelper from '../helpers/base-report.helper';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { CONFIG } from '../../../config/constants';

type UserInstance = typeof User.prototype;

export class UserService {
  async getAppUsers(
    payload: GetUsersPayload,
    scope: ReportScope
  ): Promise<ReportResponse<UserInstance>> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    const sorting = this.normalizeCommonSorting(payload as any);
    let { hostId, filter } = payload;
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
      ...report,
      data: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
    } as ReportResponse<UserInstance>;
  }

  async getUserDetails(
    payload: { hostId: number, userId: number },
    scope: ReportScope
  ): Promise<any> {
    let { hostId, userId } = payload;

    const userDetails = await usersRepository.getUserById({
      hostId,
      userId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    return formatDateTimeFieldsBySettings(userDetails, dateTimeSettings);
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
}

export default new UserService();