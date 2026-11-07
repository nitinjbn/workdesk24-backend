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
import { Transaction } from 'sequelize';

export class HostService {
  async getSwitchHostContext(
    hostId: number,
    transaction?: Transaction,
    lock = false
  ): Promise<{
    host: any;
    subscription: any;
    accessMode: 'SUPPORT_FULL' | 'SUPPORT_READ_ONLY';
  } | null> {
    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const timeZone = dateTimeSettings.timeZone || CONFIG.REPORTING.TIMEZONE;
    const currentDate = DateTimeFormatUtil.getCurrentDateInTimeZone(timeZone);
    const result = await hostRepository.getHostSwitchContext({
      hostId,
      currentDate,
      transaction,
      lock,
    });

    if (!result.host) {
      return null;
    }

    const isEntitled =
      result.subscription?.isEnabled === 1 && result.subscription?.paymentStatus === 'PAID';

    return {
      host: result.host.toJSON(),
      subscription: result.subscription?.toJSON() || null,
      accessMode: isEntitled ? 'SUPPORT_FULL' : 'SUPPORT_READ_ONLY',
    };
  }

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

  async getHostBySubDomain(payload: { subDomain: string }): Promise<any> {
    const { subDomain } = payload;
    if (!subDomain) {
      throw new Error('subDomain is required');
    }
    return hostRepository.getHostBySubDomain({ subDomain });
  }
}

export default new HostService();
