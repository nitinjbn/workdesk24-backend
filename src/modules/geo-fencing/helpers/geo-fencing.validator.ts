import { createConfiguredError } from '../../../shared/utils/error.util';

class GeoFencingValidator {
  static validateHostId(hostId: number) {
    if (!hostId) {
      throw createConfiguredError('INVALID_PARAMETERS', 'Host ID is required.');
    }
  }

  static validateAttendanceSitePayload(
    type: 'CREATE' | 'GET_LIST' | 'GET_BY_ID' | 'UPDATE' | 'DELETE',
    payload: any
  ): void {
    const requiredFields: Record<string, string[]> = {
      CREATE: ['hostId', 'latitude', 'longitude', 'radiusMeters', 'siteName', 'isEnabled'],
      GET_LIST: ['hostId'],
      GET_BY_ID: ['hostId', 'attendanceSiteId'],
      UPDATE: [
        'hostId',
        'attendanceSiteId',
        'siteName',
        'latitude',
        'longitude',
        'radiusMeters',
        'isEnabled',
      ],
      DELETE: ['hostId', 'attendanceSiteId'],
    };

    const fields = requiredFields[type];

    if (!fields) {
      throw createConfiguredError('INVALID_PARAMETERS', 'Invalid validation type.');
    }

    for (const field of fields) {
      const value = payload?.[field];

      if (
        value === undefined ||
        value === null ||
        (typeof value === 'string' && value.trim() === '')
      ) {
        throw createConfiguredError('INVALID_PARAMETERS', `${field} is required.`);
      }
    }
  }
}

export default GeoFencingValidator;
