import hostRepository from '../repositories/host.repository';
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
import { CONFIG } from '../../../config/constants';

export class HostService {
  async getCurrentSubscription(hostId: number): Promise<any> {
    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const timeZone = dateTimeSettings.timeZone || CONFIG.REPORTING.TIMEZONE;

    // Get the current date in the host's time zone
    const currentDate = DateTimeFormatUtil.getCurrentDateInTimeZone(timeZone);

    const subscription = await hostRepository.getHostCurrentSubscription({ hostId, currentDate });

    return {
      ...subscription.data,
    };
  }
}

export default new HostService();
