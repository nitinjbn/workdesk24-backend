import { HostDateTimeSettings } from './host-settings.util';
import moment from 'moment-timezone';
import { CONFIG } from '../../config/constants';

const TIMESTAMP_KEY_PATTERN = /(At|Date|Time|dateOfBirth)$/i;

const DEFAULT_DATE_TIME_SETTINGS: HostDateTimeSettings = {
  timeZone: CONFIG.REPORTING.TIMEZONE,
  dateTimeFormat: CONFIG.REPORTING.DATE_TIME_FORMAT,
};

export class DateTimeFormatUtil {
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

  private static formatUnixValue(value: number | string, settings?: HostDateTimeSettings): string | number {
    const unixMs = DateTimeFormatUtil.asUnixMs(value);
    if (unixMs === null) {
      return value;
    }

    const effectiveSettings = settings || DEFAULT_DATE_TIME_SETTINGS;
    const configuredTimeZone = effectiveSettings.timeZone || DEFAULT_DATE_TIME_SETTINGS.timeZone;
    const timeZone = moment.tz.zone(configuredTimeZone)
      ? configuredTimeZone
      : DEFAULT_DATE_TIME_SETTINGS.timeZone;

    const formatPattern = effectiveSettings.dateTimeFormat || DEFAULT_DATE_TIME_SETTINGS.dateTimeFormat;
    const dateTime = moment.tz(unixMs, timeZone);

    if (!dateTime.isValid()) {
      return value;
    }

    return dateTime.format(formatPattern);
  }

  private static cloneAndFormat(input: unknown, settings?: HostDateTimeSettings): unknown {
    if (Array.isArray(input)) {
      return input.map((item) => DateTimeFormatUtil.cloneAndFormat(item, settings));
    }

    if (!input || typeof input !== 'object') {
      return input;
    }

    const record = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    Object.entries(record).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        output[key] = DateTimeFormatUtil.cloneAndFormat(value, settings);
        return;
      }

      if (TIMESTAMP_KEY_PATTERN.test(key) && DateTimeFormatUtil.isTimestampLikeValue(value)) {
        output[key] = DateTimeFormatUtil.formatUnixValue(value, settings);
        return;
      }

      output[key] = value;
    });

    return output;
  }

  static formatDateTimeFieldsBySettings<T>(data: T, settings?: HostDateTimeSettings): T {
    return DateTimeFormatUtil.cloneAndFormat(data, settings) as T;
  }

  static getCurrentUnixTime(timezone = 'UTC'): number {
    console.log("############################## getCurrentUnixTime Started:", moment().tz(timezone).unix());
    return moment().tz(timezone).unix();
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
    return Object.keys(CONFIG.WEEKDAY_FLAGS).filter(day => (mask & CONFIG.WEEKDAY_FLAGS[day]) !== 0);

    // Example
    // console.log(DateTimeFormatUtil.getWeeklyOffDays(65));
    // Output: ['SUNDAY', 'SATURDAY']
  }

}

export const formatDateTimeFieldsBySettings = <T>(data: T, settings?: HostDateTimeSettings): T => {
  return DateTimeFormatUtil.formatDateTimeFieldsBySettings(data, settings);
};
