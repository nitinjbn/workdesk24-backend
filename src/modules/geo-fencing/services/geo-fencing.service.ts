import geoFencingRepository from '../repositories/geo-fencing.repository';
import {
  GetProductsPayload,
  CommonReportSorting,
  ReportScope,
} from '../types/geo-fencing.types';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

export class GeoFencingService {
  async createAttendanceLocation(
    payload: { hostId: number, latitude: number, longitude: number, radiusMeters: number, locationName: string, isEnabled: boolean }
  ): Promise<any> {
    
    const { hostId, latitude, longitude, radiusMeters, locationName, isEnabled } = payload;
    const trimmedLocationName = locationName.trim();

    const isDuplicate = await geoFencingRepository.checkAttendanceLocationNameExists(
      hostId,
      trimmedLocationName
    );

    if (isDuplicate) {
      throw createConfiguredError(
        'DUPLICATE_ATTENDANCE_LOCATION_NAME',
        'An attendance location with this name already exists',
        400
      );
    }
    
    
    const createdLocation = await geoFencingRepository.createAttendanceLocation({
      hostId,
      latitude,
      longitude,
      radiusMeters,
      locationName: trimmedLocationName,
      isEnabled
    });

    return { attendanceLocation: createdLocation };
  }

  async getAttendanceLocations(
    payload: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sorting?: CommonReportSorting },
    scope: ReportScope
  ): Promise<{ attendanceLocations: any[], pagination?: any }> {
    
    const { hostId, filter, page, limit } = payload;
    const sorting = this.normalizeCommonSorting(payload);

    const report = await geoFencingRepository.getAttendanceLocations({
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
      attendanceLocations: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getAttendanceLocationById(
    payload: { hostId: number, attendanceLocationId: number },
    scope: ReportScope
  ): Promise<any> {
    let { hostId, attendanceLocationId } = payload;

    const attendanceLocationDetails = await geoFencingRepository.getAttendanceLocationById({
      hostId,
      attendanceLocationId
    });    
    if (!attendanceLocationDetails || !Object(attendanceLocationDetails.data) || Object.keys(attendanceLocationDetails.data).length === 0) {
      throw createConfiguredError("ATTENDANCE_LOCATION_NOT_FOUND", 'Attendance location not found.');
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = attendanceLocationDetails?.data && typeof attendanceLocationDetails.data.toJSON === 'function' 
      ? attendanceLocationDetails.data.toJSON() 
      : attendanceLocationDetails?.data;
    return {
      attendanceLocation: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  private normalizeCommonSorting(payload: GetProductsPayload): { sortBy: string, sortOrder: "ASC" | "DESC" } {
    const requestedSortBy = payload.sort?.by || payload.sortBy;
    const requestedSortOrder = payload.sort?.order || payload.sortOrder;

    return {
      sortBy: requestedSortBy,
      sortOrder: requestedSortOrder as "ASC" | "DESC"
    }
  }

  async updateAttendanceLocation(payload: any): Promise<any> {
      const { hostId, attendanceLocationId, locationName, latitude, longitude, radiusMeters, isEnabled } = payload;
  
      const attendanceLocationDetails = await geoFencingRepository.getAttendanceLocationById({
        hostId,
        attendanceLocationId
      });
      if (!attendanceLocationDetails || !Object(attendanceLocationDetails.data) || Object.keys(attendanceLocationDetails.data).length === 0) {
        throw createConfiguredError("ATTENDANCE_LOCATION_NOT_FOUND", 'Attendance location not found.');
      }

      const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();
  
      let updateObj: any = {
        locationName,
        latitude,
        longitude,
        radiusMeters,
        isEnabled,
        updatedAt: currentUnixTime
      };
  
      const updateAttendanceLocationResult = await geoFencingRepository.updateAttendanceLocation({
        updatePayload: updateObj, 
        where: {hostId, attendanceLocationId}}
      );
  
      if (!updateAttendanceLocationResult) {
        throw new Error('Failed to update attendance location');
      }
      return { attendanceLocation: updateAttendanceLocationResult };
    }
}

export default new GeoFencingService();