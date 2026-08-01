import attendanceReportRepository from '../repositories/attendance-app-report.repository';
import ordersReportRepository from '../repositories/orders-app-report.repository';
import visitsReportRepository from '../repositories/visits-app-report.repository';
import paymentsReportRepository from '../repositories/payments-app-report.repository';
import feedbacksReportRepository from '../repositories/feedbacks-app-report.repository';
import imagesReportRepository from '../repositories/images-app-report.repository';

import {
  AttendanceReportResponse,
  AttendanceReportPayload
} from '../types/report.types';
import { Attendance } from '../../../models/schemas';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { DateTimeFormatUtil, formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
type AttendanceInstance = typeof Attendance.prototype;
export class ReportService {
  
  async getAttendanceReport(
    payload: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number } } & AttendanceReportPayload,
  ): Promise<AttendanceReportResponse<AttendanceInstance>> {
    const { hostId, userId, filter } = payload;
    //const { page, limit } = payload; // Commented because pagination is mandatory for this report and if not provided, it will default to page 1 and limit 10 in the repository.

    const report = await attendanceReportRepository.getReport({
      hostId,
      filter,
      userId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) => {
      const attendance = item && typeof item.toJSON === 'function'
        ? item.toJSON()
        : item;

      return {
        day: DateTimeFormatUtil.getDayFromUnix(attendance.attendanceTime, dateTimeSettings.timeZone),
        ...attendance,
      };
    });

    return {
      attendance: formatDateTimeFieldsBySettings(plainData, dateTimeSettings)
    };
  }


  async getOrdersReport(
    payload: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number; customerId?: number } },
  ): Promise<any> {
    const { hostId, userId, filter } = payload;

    const report = await ordersReportRepository.getOrdersReport({
      hostId,
      filter,
      userId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) => {
      const order = item && typeof item.toJSON === 'function'
        ? item.toJSON()
        : item;
      return order;
    });

    return {
      orders: formatDateTimeFieldsBySettings(plainData, dateTimeSettings)
    };
  }
  
  async getVisitsReport(
    payload: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number; customerId?: number } },
  ): Promise<any> {
    const { hostId, userId, filter } = payload;

    const report = await visitsReportRepository.getVisitsReport({
      hostId,
      filter,
      userId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) => {
      const visit = item && typeof item.toJSON === 'function'
        ? item.toJSON()
        : item;
      return visit;
    });

    return {
      visits: formatDateTimeFieldsBySettings(plainData, dateTimeSettings)
    };
  }

  async getPaymentsReport(
    payload: { hostId: number; userId?: number; filter?: { paymentCaptureTime?: { fromDate: number; tillDate: number }; customerId?: number } },
  ): Promise<any> {
    const { hostId, userId, filter } = payload;

    const report = await paymentsReportRepository.getPaymentsReport({
      hostId,
      filter,
      userId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) => {
      const payment = item && typeof item.toJSON === 'function'
        ? item.toJSON()
        : item;
      return payment;
    });

    return {
      payments: formatDateTimeFieldsBySettings(plainData, dateTimeSettings)
    };
  }

  async getFeedbacksReport(
    payload: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number; customerId?: number } },
  ): Promise<any> {
    const { hostId, userId, filter } = payload;

    const report = await feedbacksReportRepository.getFeedbacksReport({
      hostId,
      filter,
      userId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) => {
      const feedback = item && typeof item.toJSON === 'function'
        ? item.toJSON()
        : item;
      return feedback;
    });

    return {
      feedbacks: formatDateTimeFieldsBySettings(plainData, dateTimeSettings)
    };
  }

  async getImagesReport(
    payload: { hostId: number; userId?: number; filter?: { fromDate: number; tillDate: number; customerId?: number } },
  ): Promise<any> {
    const { hostId, userId, filter } = payload;

    const report = await imagesReportRepository.getImagesReport({
      hostId,
      filter,
      userId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) => {
      const feedback = item && typeof item.toJSON === 'function'
        ? item.toJSON()
        : item;
      return feedback;
    });

    return {
      images: formatDateTimeFieldsBySettings(plainData, dateTimeSettings)
    };
  }
}

export default new ReportService();