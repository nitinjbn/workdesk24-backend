import moment from 'moment-timezone';
import { User } from '../../models';
import { CONFIG } from '../../config/constants';
import { getUserSettingsValues } from './user-settings.util';
import { getHostSettingsValues } from './host-settings.util';

export enum OvertimeCalculationType {
  BOTH_SIDES = 'BOTH_SIDES',
  AFTER_SHIFT_END = 'AFTER_SHIFT_END',
  NONE = 'NONE',
}

const USER_SETTING_SHIFT_START_TIME = 'reportingTime';
const USER_SETTING_SHIFT_END_TIME = 'shiftEndTime';
const USER_SETTING_OVERTIME_ALLOWED = 'overtimeAllowed';
const HOST_SETTING_OVERTIME_CALCULATION_TYPE = 'overtimeCalculationType';

export interface AttendanceShiftContext {
  timezone: string;
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  overtimeAllowed: number;
  overtimeCalculationType: OvertimeCalculationType;
}

export interface AttendanceShiftMetrics {
  shiftStartTime: string | null;
  shiftEndTime: string | null;
  earlyAttendanceMinutes: number;
  lateAttendanceMinutes: number;
  earlyDayoverMinutes: number;
  lateDayoverMinutes: number;
  overtimeAllowed: number;
  overtimeMinutes: number;
  shortfallMinutes: number;
}

const toPositiveUnix = (value: unknown): number | null => {
  const parsedValue = Number(value);
  return Number.isFinite(parsedValue) && parsedValue > 0 ? Math.floor(parsedValue) : null;
};

/** Accepts `HH:mm` or `HH:mm:ss` and returns `HH:mm:ss`, or null when not configured. */
export const normalizeShiftTime = (value: unknown): string | null => {
  if (typeof value !== 'string') {
    return null;
  }

  const match = value.trim().match(/^(\d{1,2}):(\d{2})(?::(\d{2}))?$/);
  if (!match) {
    return null;
  }

  const hours = Number(match[1]);
  const minutes = Number(match[2]);
  const seconds = match[3] ? Number(match[3]) : 0;

  if (hours > 23 || minutes > 59 || seconds > 59) {
    return null;
  }

  const pad = (unit: number): string => String(unit).padStart(2, '0');
  return `${pad(hours)}:${pad(minutes)}:${pad(seconds)}`;
};

const toSecondsOfDay = (shiftTime: string): number => {
  const [hours, minutes, seconds] = shiftTime.split(':').map(Number);
  return hours * 3600 + minutes * 60 + seconds;
};

const toBooleanFlag = (value: unknown): number => {
  if (typeof value === 'string') {
    const normalizedValue = value.trim().toLowerCase();
    return normalizedValue === '1' || normalizedValue === 'true' || normalizedValue === 'yes'
      ? 1
      : 0;
  }

  return Number(value) === 1 ? 1 : 0;
};

const toOvertimeCalculationType = (value: unknown): OvertimeCalculationType => {
  const normalizedValue = String(value ?? '')
    .trim()
    .toUpperCase();

  return normalizedValue === OvertimeCalculationType.BOTH_SIDES ||
    normalizedValue === OvertimeCalculationType.AFTER_SHIFT_END
    ? (normalizedValue as OvertimeCalculationType)
    : OvertimeCalculationType.NONE;
};

/**
 * Overtime is capped by the net surplus (worked - shift) so that late arrivals or
 * early exits cancel out the creditable edges instead of being paid twice.
 */
export const calculateOvertimeMinutes = (
  earlyAttendanceMinutes: number,
  lateDayoverMinutes: number,
  surplusMinutes: number,
  overtimeAllowed: boolean,
  overtimeCalculationType: OvertimeCalculationType
): number => {
  // Overtime is calculated even when its not allowed, we can manage on the frontend or later in the logic.
  if (!Number.isFinite(surplusMinutes) || surplusMinutes <= 0) {
    return 0;
  }

  switch (overtimeCalculationType) {
    case OvertimeCalculationType.BOTH_SIDES:
      return Math.min(earlyAttendanceMinutes + lateDayoverMinutes, surplusMinutes);

    case OvertimeCalculationType.AFTER_SHIFT_END:
      return Math.min(lateDayoverMinutes, surplusMinutes);

    default:
      return 0;
  }
};

/**
 * Time the employee still owes against the rostered shift duration, so an early
 * start offsets an early finish and a late finish offsets a late start.
 */
export const calculateShortfallMinutes = (surplusMinutes: number): number => {
  if (!Number.isFinite(surplusMinutes)) {
    return 0;
  }

  return Math.max(0, -surplusMinutes);
};

export const getAttendanceShiftContext = async (
  hostId: number,
  userId: number
): Promise<AttendanceShiftContext> => {
  const [userRow, userSettings, hostSettings] = await Promise.all([
    User.findOne({
      attributes: ['timezone'],
      where: { hostId, id: userId, isDeleted: 0 },
    }),
    getUserSettingsValues(userId, [
      USER_SETTING_SHIFT_START_TIME,
      USER_SETTING_SHIFT_END_TIME,
      USER_SETTING_OVERTIME_ALLOWED,
    ]),
    getHostSettingsValues(hostId, [HOST_SETTING_OVERTIME_CALCULATION_TYPE]),
  ]);

  const userTimezone = (userRow as any)?.timezone;

  return {
    timezone: moment.tz.zone(userTimezone) ? userTimezone : CONFIG.REPORTING.TIMEZONE,
    shiftStartTime: normalizeShiftTime(userSettings[USER_SETTING_SHIFT_START_TIME]),
    shiftEndTime: normalizeShiftTime(userSettings[USER_SETTING_SHIFT_END_TIME]),
    overtimeAllowed: toBooleanFlag(userSettings[USER_SETTING_OVERTIME_ALLOWED]),
    overtimeCalculationType: toOvertimeCalculationType(
      hostSettings[HOST_SETTING_OVERTIME_CALCULATION_TYPE]
    ),
  };
};

export const buildAttendanceShiftMetrics = (
  context: AttendanceShiftContext,
  attendanceTime: unknown,
  dayoverTime?: unknown
): AttendanceShiftMetrics => {
  const { timezone, shiftStartTime, shiftEndTime, overtimeAllowed, overtimeCalculationType } =
    context;
  const attendanceUnix = toPositiveUnix(attendanceTime);
  const dayoverUnix = toPositiveUnix(dayoverTime);
  const metrics: AttendanceShiftMetrics = {
    shiftStartTime,
    shiftEndTime,
    earlyAttendanceMinutes: 0,
    lateAttendanceMinutes: 0,
    earlyDayoverMinutes: 0,
    lateDayoverMinutes: 0,
    overtimeAllowed,
    overtimeMinutes: 0,
    shortfallMinutes: 0,
  };

  // Both shift boundaries are anchored to the attendance day so that overnight
  // shifts (shift end <= shift start) roll the end boundary to the next day.
  const anchorUnix = attendanceUnix ?? dayoverUnix;
  if (anchorUnix === null) {
    return metrics;
  }

  const startOfDayUnix = moment.unix(anchorUnix).tz(timezone).startOf('day').unix();
  const shiftStartSeconds = shiftStartTime === null ? null : toSecondsOfDay(shiftStartTime);
  const shiftEndSeconds = shiftEndTime === null ? null : toSecondsOfDay(shiftEndTime);

  if (attendanceUnix !== null && shiftStartSeconds !== null) {
    const attendanceDeltaMinutes = Math.round(
      (attendanceUnix - (startOfDayUnix + shiftStartSeconds)) / 60
    );
    metrics.earlyAttendanceMinutes = Math.max(0, -attendanceDeltaMinutes);
    metrics.lateAttendanceMinutes = Math.max(0, attendanceDeltaMinutes);
  }

  if (dayoverUnix !== null && shiftEndSeconds !== null) {
    const shiftEndUnix =
      startOfDayUnix +
      shiftEndSeconds +
      (shiftStartSeconds !== null && shiftEndSeconds <= shiftStartSeconds ? 86400 : 0);
    const dayoverDeltaMinutes = Math.round((dayoverUnix - shiftEndUnix) / 60);
    metrics.earlyDayoverMinutes = Math.max(0, -dayoverDeltaMinutes);
    metrics.lateDayoverMinutes = Math.max(0, dayoverDeltaMinutes);

    // Overtime and shortfall are two sides of the same net surplus, so both shift
    // boundaries and both punches are required before either can be derived.
    if (shiftStartSeconds !== null && attendanceUnix !== null) {
      const shiftMinutes = (shiftEndUnix - (startOfDayUnix + shiftStartSeconds)) / 60;
      const workedMinutes = (dayoverUnix - attendanceUnix) / 60;
      const surplusMinutes = Math.round(workedMinutes - shiftMinutes);

      metrics.overtimeMinutes = calculateOvertimeMinutes(
        metrics.earlyAttendanceMinutes,
        metrics.lateDayoverMinutes,
        surplusMinutes,
        overtimeAllowed === 1,
        overtimeCalculationType
      );
      metrics.shortfallMinutes = calculateShortfallMinutes(surplusMinutes);
    }
  }

  return metrics;
};
