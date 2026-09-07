import geoFencingRepository from '../repositories/geo-fencing.repository';
import { GetProductsPayload, CommonReportSorting, ReportScope } from '../types/geo-fencing.types';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

export class GeoFencingService {
  async createAttendanceSite(payload: {
    hostId: number;
    latitude: number;
    longitude: number;
    radiusMeters: number;
    siteName: string;
    isEnabled: boolean;
    siteUsers: number[];
  }): Promise<any> {
    const { hostId, latitude, longitude, radiusMeters, siteName, isEnabled, siteUsers } = payload;
    const trimmedSiteName = siteName.trim();

    const isDuplicate = await geoFencingRepository.checkAttendanceSiteNameExists(
      hostId,
      trimmedSiteName
    );

    if (isDuplicate) {
      throw createConfiguredError(
        'DUPLICATE_ATTENDANCE_SITE_NAME',
        'An attendance site with this name already exists',
        400
      );
    }

    const createdLocation = await geoFencingRepository.createAttendanceSite({
      hostId,
      latitude,
      longitude,
      radiusMeters,
      siteName: trimmedSiteName,
      isEnabled,
      siteUsers,
    });

    return { attendanceSite: createdLocation };
  }

  async getAttendanceSites(
    payload: {
      hostId: number;
      filter?: Record<string, unknown>;
      page?: number;
      limit?: number;
      sorting?: CommonReportSorting;
    },
    scope: ReportScope
  ): Promise<{ attendanceSites: any[]; pagination?: any }> {
    const { hostId, filter, page, limit } = payload;
    const sorting = this.normalizeCommonSorting(payload);

    const report = await geoFencingRepository.getAttendanceSites({
      hostId,
      page,
      limit,
      filter,
      sortBy: sorting?.sortBy,
      sortOrder: sorting?.sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      attendanceSites: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getAttendanceSiteById(payload: {
    hostId: number;
    attendanceSiteId: number;
    includeSiteUsers?: boolean;
  }): Promise<any> {
    const { hostId, attendanceSiteId, includeSiteUsers } = payload;
    const attendanceSiteDetails = await geoFencingRepository.getAttendanceSiteById({
      hostId,
      attendanceSiteId,
      includeSiteUsers,
    });
    if (
      !attendanceSiteDetails ||
      !Object(attendanceSiteDetails.data) ||
      Object.keys(attendanceSiteDetails.data).length === 0
    ) {
      throw createConfiguredError('ATTENDANCE_SITE_NOT_FOUND', 'Attendance site not found.');
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      attendanceSiteDetails?.data && typeof attendanceSiteDetails.data.toJSON === 'function'
        ? attendanceSiteDetails.data.toJSON()
        : attendanceSiteDetails?.data;
    return {
      attendanceSite: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  private normalizeCommonSorting(payload: GetProductsPayload): {
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
  } {
    const requestedSortBy = payload.sort?.by || payload.sortBy;
    const requestedSortOrder = payload.sort?.order || payload.sortOrder;

    return {
      sortBy: requestedSortBy,
      sortOrder: requestedSortOrder as 'ASC' | 'DESC',
    };
  }

  async updateAttendanceSite(payload: any): Promise<any> {
    const {
      hostId,
      attendanceSiteId,
      siteName,
      latitude,
      longitude,
      radiusMeters,
      isEnabled,
      siteUsers,
    } = payload;

    const attendanceSiteDetails = await geoFencingRepository.getAttendanceSiteById({
      hostId,
      attendanceSiteId,
    });
    if (
      !attendanceSiteDetails ||
      !Object(attendanceSiteDetails.data) ||
      Object.keys(attendanceSiteDetails.data).length === 0
    ) {
      throw createConfiguredError('ATTENDANCE_SITE_NOT_FOUND', 'Attendance site not found.');
    }

    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    let updateObj: any = {
      siteName,
      latitude,
      longitude,
      radiusMeters,
      isEnabled,
      siteUsers,
      updatedAt: currentUnixTime,
    };

    const updateAttendanceSiteResult = await geoFencingRepository.updateAttendanceSite({
      updatePayload: updateObj,
      where: { hostId, id: attendanceSiteId },
      siteUsers,
    });

    if (!updateAttendanceSiteResult) {
      throw new Error('Failed to update attendance site');
    }

    return {};
  }

  async deleteAttendanceSite(payload: any): Promise<any> {
    const { hostId, attendanceSiteId } = payload;
    const deleteResult = await geoFencingRepository.updateAttendanceSite({
      updatePayload: {
        isDeleted: 1,
        deletedAt: DateTimeFormatUtil.getCurrentUnixTime(),
      },
      where: {
        hostId,
        id: attendanceSiteId,
      },
      siteUsers: [], // No site users should be associated with a deleted attendance location
    });

    if (!deleteResult) {
      throw new Error('Failed to delete attendance site');
    }

    return {};
  }
}

export default new GeoFencingService();
