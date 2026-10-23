import { HostDateTimeSettings } from './host-settings.util';
import moment from 'moment-timezone';
import { CONFIG } from '../../config/constants';
import { createConfiguredError } from './error.util';

const TIMESTAMP_KEY_PATTERN = /(At|Date|Time|dateOfBirth)$/i;

// Field format configuration: defines how each field should be formatted
const FIELD_FORMAT_CONFIG: Record<string, 'date' | 'datetime'> = {
  // Date-only fields (YYYY-MM-DD)
  dateOfBirth: 'date',
  joiningDate: 'date',

  // DateTime fields (full format)
  createdAt: 'datetime',
  updatedAt: 'datetime',
  accountStatusUpdatedAt: 'datetime',
  deletedAt: 'datetime',
};

const DEFAULT_DATE_TIME_SETTINGS: HostDateTimeSettings = {
  timeZone: CONFIG.REPORTING.TIMEZONE,
  dateTimeFormat: CONFIG.REPORTING.DATE_TIME_FORMAT,
  dateFormat: CONFIG.REPORTING.DATE_FORMAT,
  timeFormat: CONFIG.REPORTING.TIME_FORMAT,
};

export class DateTimeFormatUtil {
  static getUnixDayRange(date: unknown, timeZone: string): { fromDate: number; tillDate: number } {
    if (typeof timeZone !== 'string' || !moment.tz.zone(timeZone)) {
      throw createConfiguredError('INVALID_TIME_ZONE', 'A valid IANA timeZone is required', 400, 'INVALID_TIME_ZONE');
    }
    if (typeof date !== 'string' || !/^(\d{4}-\d{2}-\d{2}|\d{2}\/\d{2}\/\d{4})$/.test(date)) {
      throw createConfiguredError('INVALID_DATE_FILTER', 'Date filters must use YYYY-MM-DD or DD/MM/YYYY', 400, 'INVALID_DATE_FILTER');
    }
    const dateFormat = date.includes('/') ? 'DD/MM/YYYY' : 'YYYY-MM-DD';
    const localDate = moment.tz(date, dateFormat, true, timeZone);
    if (!localDate.isValid() || localDate.format(dateFormat) !== date) {
      throw createConfiguredError('INVALID_DATE_FILTER', 'Date filter must be a valid calendar date in the selected timezone', 400, 'INVALID_DATE_FILTER');
    }
    return {
      fromDate: localDate.clone().startOf('day').unix(),
      tillDate: localDate.clone().endOf('day').unix(),
    };
  }

  private static asUnixMs(value: number | string): number | null {
    const numericValue = Number(value);
    if (!Number.isFinite(numericValue) || numericValue <= 0) {
      return null;
    }

    if (numericValue >= 1_000_000_000_000) {
      return Math.floor(numericValue);
    }

    return Math.floor(numericValue * 1000);
  }

  private static isTimestampLikeValue(value: unknown): value is number | string {
    if (typeof value === 'number') {
      return Number.isFinite(value) && value > 0;
    }

    if (typeof value === 'string') {
      return /^\d+(\.\d+)?$/.test(value.trim());
    }

    return false;
  }

  private static formatUnixValue(
    value: number | string,
    settings?: HostDateTimeSettings,
    formatType: 'date' | 'datetime' = 'datetime'
  ): string | number {
    const unixMs = DateTimeFormatUtil.asUnixMs(value);
    if (unixMs === null) {
      return value;
    }

    const effectiveSettings = settings || DEFAULT_DATE_TIME_SETTINGS;
    const configuredTimeZone = effectiveSettings.timeZone || DEFAULT_DATE_TIME_SETTINGS.timeZone;
    const timeZone = moment.tz.zone(configuredTimeZone)
      ? configuredTimeZone
      : DEFAULT_DATE_TIME_SETTINGS.timeZone;

    // Use date-only format (YYYY-MM-DD) for date fields, full format for datetime
    const formatPattern =
      formatType === 'date'
        ? effectiveSettings.dateFormat || DEFAULT_DATE_TIME_SETTINGS.dateFormat
        : effectiveSettings.dateTimeFormat || DEFAULT_DATE_TIME_SETTINGS.dateTimeFormat;
    const dateTime = moment.tz(unixMs, timeZone);

    if (!dateTime.isValid()) {
      return value;
    }

    return dateTime.format(formatPattern);
  }

  private static cloneAndFormat(
    input: unknown,
    settings?: HostDateTimeSettings,
    fieldFormatConfig?: Record<string, 'date' | 'datetime'>
  ): unknown {
    if (Array.isArray(input)) {
      return input.map((item) =>
        DateTimeFormatUtil.cloneAndFormat(item, settings, fieldFormatConfig)
      );
    }

    if (!input || typeof input !== 'object') {
      return input;
    }

    const config = fieldFormatConfig || FIELD_FORMAT_CONFIG;
    const record = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    Object.entries(record).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        output[key] = DateTimeFormatUtil.cloneAndFormat(value, settings, fieldFormatConfig);
        return;
      }

      // Check if field has explicit format config
      const formatType = config[key];
      if (formatType && DateTimeFormatUtil.isTimestampLikeValue(value)) {
        output[key] = DateTimeFormatUtil.formatUnixValue(value, settings, formatType);
        return;
      }

      // Fallback to pattern matching for other timestamp fields
      if (TIMESTAMP_KEY_PATTERN.test(key) && DateTimeFormatUtil.isTimestampLikeValue(value)) {
        output[key] = DateTimeFormatUtil.formatUnixValue(value, settings, 'datetime');
        return;
      }

      output[key] = value;
    });

    return output;
  }

  static formatDateTimeFieldsBySettings<T>(
    data: T,
    settings?: HostDateTimeSettings,
    fieldFormatConfig?: Record<string, 'date' | 'datetime'>
  ): T {
    return DateTimeFormatUtil.cloneAndFormat(data, settings, fieldFormatConfig) as T;
  }

  static getCurrentUnixTime(timezone = 'UTC'): number {
    console.log(
      '############################## getCurrentUnixTime Started:',
      moment().tz(timezone).unix()
    );
    return moment().tz(timezone).unix();
  }

  static getCurrentDateInTimeZone(timezone = 'Asia/Kolkata'): string {
    return moment().tz(timezone).format('YYYY-MM-DD');
  }

  static getWeeklyOffMask(days: string[]): number {
    return days.reduce((mask, day) => {
      const normalizedDay = day.toUpperCase().trim();
      return mask | (CONFIG.WEEKDAY_FLAGS[normalizedDay] || 0);
    }, 0);

    // Example
    // const mask = DateTimeFormatUtil.getWeeklyOffMask(['SATURDAY', 'SUNDAY']);
    // const mask2 = DateTimeFormatUtil.getWeeklyOffMask(['Saturday', 'sunday']);
    // Output: 65
  }

  static getWeeklyOffDays(mask: number): string[] {
    return Object.keys(CONFIG.WEEKDAY_FLAGS).filter(
      (day) => (mask & CONFIG.WEEKDAY_FLAGS[day]) !== 0
    );

    // Example
    // console.log(DateTimeFormatUtil.getWeeklyOffDays(65));
    // Output: ['SUNDAY', 'SATURDAY']
  }

  static getUnixDateRange(payload: { year: number; month: number }): {
    fromDate: number;
    tillDate: number;
  } {
    const { year, month } = payload;
    const selectedMonth = moment({ year, month: month - 1 });

    const fromDate = selectedMonth.clone().startOf('month').unix();
    const tillDate = selectedMonth.isSame(moment(), 'month')
      ? moment().endOf('day').unix()
      : selectedMonth.clone().endOf('month').unix();

    return {
      fromDate,
      tillDate,
    };
  }

  static getDayFromUnix(unixTimestamp: number, timezone = 'UTC'): number | null {
    const unixMs = DateTimeFormatUtil.asUnixMs(unixTimestamp);
    if (unixMs === null) {
      return null;
    }

    const dateTime = moment.tz(unixMs, timezone);
    if (!dateTime.isValid()) {
      return null;
    }

    return dateTime.date();
  }

  // dateStr is a DATEONLY string (YYYY-MM-DD); parsed as UTC to avoid timezone shifting the day
  static getDayNameFromDateString(dateStr: string): string | null {
    if (!dateStr) {
      return null;
    }

    const date = moment.utc(String(dateStr).slice(0, 10), 'YYYY-MM-DD', true);
    return date.isValid() ? date.format('dddd') : null;
  }
}

export const formatDateTimeFieldsBySettings = <T>(
  data: T,
  settings?: HostDateTimeSettings,
  fieldFormatConfig?: Record<string, 'date' | 'datetime'>
): T => {
  return DateTimeFormatUtil.formatDateTimeFieldsBySettings(data, settings, fieldFormatConfig);
};

export const getDayNameFromDateString = (dateStr: string): string | null => {
  return DateTimeFormatUtil.getDayNameFromDateString(dateStr);
};

export { FIELD_FORMAT_CONFIG };
