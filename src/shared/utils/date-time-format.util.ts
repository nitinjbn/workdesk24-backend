import { HostDateTimeSettings } from './host-settings.util';
import moment from 'moment-timezone';
import { CONFIG } from '../../config/constants';

const TIMESTAMP_KEY_PATTERN = /(At|Date|Time)$/i;

const DEFAULT_DATE_TIME_SETTINGS: HostDateTimeSettings = {
  timeZone: CONFIG.REPORTING.TIMEZONE,
  dateTimeFormat: CONFIG.REPORTING.DATE_TIME_FORMAT,
};

const asUnixMs = (value: number | string): number | null => {
  const numericValue = Number(value);
  if (!Number.isFinite(numericValue) || numericValue <= 0) {
    return null;
  }

  if (numericValue >= 1_000_000_000_000) {
    return Math.floor(numericValue);
  }

  return Math.floor(numericValue * 1000);
};

const isTimestampLikeValue = (value: unknown): value is number | string => {
  if (typeof value === 'number') {
    return Number.isFinite(value) && value > 0;
  }

  if (typeof value === 'string') {
    return /^\d+(\.\d+)?$/.test(value.trim());
  }

  return false;
};

const formatUnixValue = (value: number | string, settings?: HostDateTimeSettings): string | number | string => {
  const unixMs = asUnixMs(value);
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
};

const cloneAndFormat = (input: unknown, settings?: HostDateTimeSettings): unknown => {
  if (Array.isArray(input)) {
    return input.map((item) => cloneAndFormat(item, settings));
  }

  if (!input || typeof input !== 'object') {
    return input;
  }

  const record = input as Record<string, unknown>;
  const output: Record<string, unknown> = {};

  Object.entries(record).forEach(([key, value]) => {
    if (value && typeof value === 'object') {
      output[key] = cloneAndFormat(value, settings);
      return;
    }

    if (TIMESTAMP_KEY_PATTERN.test(key) && isTimestampLikeValue(value)) {
      output[key] = formatUnixValue(value, settings);
      return;
    }

    output[key] = value;
  });

  return output;
};

export const formatDateTimeFieldsBySettings = <T>(data: T, settings?: HostDateTimeSettings): T => {
  return cloneAndFormat(data, settings) as T;
};
