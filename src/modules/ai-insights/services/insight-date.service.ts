import {
  AiInsightDateFilter,
  AiInsightResolvedDateRange
} from "../types/ai-insights.types";
import moment from 'moment-timezone';
import { CONFIG } from '../../../config/constants';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { createConfiguredError } from '../../../shared/utils/error.util';

export class InsightDateService {

  async getHostTimezone(
    hostId: number
  ): Promise<string> {
    const settings = await getHostDateTimeSettings(hostId);
    const fallbackTimeZone = CONFIG.REPORTING.TIMEZONE;
    const configuredTimeZone = settings.timeZone || fallbackTimeZone;
    return moment.tz.zone(configuredTimeZone)
      ? configuredTimeZone
      : fallbackTimeZone;
  }

  resolveDateRange(params: {
    filter?: AiInsightDateFilter;
    timezone: string;
  }): AiInsightResolvedDateRange {

    const {
      filter,
      timezone
    } = params;

    if (!filter) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'Date filter is required',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (filter.type === "custom") {
      return this.resolveCustomDateRange(
        filter.startDate,
        filter.endDate,
        timezone
      );
    }

    return this.resolvePresetDateRange(
      filter.value,
      timezone
    );
  }

  private resolvePresetDateRange(
    preset: Exclude<
      AiInsightDateFilter,
      { type: "custom" }
    >["value"],
    timezone: string
  ): AiInsightResolvedDateRange {

    const now = moment().tz(timezone);
    let start = now.clone();
    let end = now.clone();

    switch (preset) {
      case "today":
        start = now.clone().startOf('day');
        end = now.clone().endOf('day');
        break;

      case "yesterday":
        start = now.clone().subtract(1, 'day').startOf('day');
        end = now.clone().subtract(1, 'day').endOf('day');
        break;

      case 'this_week':
        start = now.clone().startOf('week');
        end = now.clone().endOf('day');
        break;

      case 'last_week':
        start = now.clone().subtract(1, 'week').startOf('week');
        end = now.clone().subtract(1, 'week').endOf('week');
        break;

      case "this_month":
        start = now.clone().startOf('month');
        end = now.clone().endOf('day');
        break;

      case 'last_month':
        start = now.clone().subtract(1, 'month').startOf('month');
        end = now.clone().subtract(1, 'month').endOf('month');
        break;

      default:
        throw createConfiguredError(
          'VALIDATION_ERROR',
          `Unsupported date preset: ${preset}`,
          400,
          'VALIDATION_ERROR'
        );
    }

    return this.createRange({
      start,
      end,
      timezone
    });
  }

  private resolveCustomDateRange(
    startDate: string,
    endDate: string,
    timezone: string
  ): AiInsightResolvedDateRange {

    this.validateDate(startDate);
    this.validateDate(endDate);

    if (startDate > endDate) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'Start date cannot be greater than end date',
        400,
        'VALIDATION_ERROR'
      );
    }

    const start = moment.tz(startDate, 'YYYY-MM-DD', true, timezone).startOf('day');
    const end = moment.tz(endDate, 'YYYY-MM-DD', true, timezone).endOf('day');

    if (!start.isValid() || !end.isValid()) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'Invalid custom date range',
        400,
        'VALIDATION_ERROR'
      );
    }

    const rangeDays = end.diff(start, 'days') + 1;
    const maxRangeDays = 366;
    if (rangeDays > maxRangeDays) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        `Custom date range cannot exceed ${maxRangeDays} days`,
        400,
        'VALIDATION_ERROR'
      );
    }

    return this.createRange({ start, end, timezone });
  }

  private createRange(
    params: {
      start: moment.Moment;
      end: moment.Moment;
      timezone: string;
    }
  ): AiInsightResolvedDateRange {

    const {
      start,
      end,
      timezone
    } = params;

    return {
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),

      timezone
    };
  }

  private validateDate(
    value: string
  ): void {

    const isValid =
      /^\d{4}-\d{2}-\d{2}$/.test(value);

    if (!isValid) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        `Invalid date: ${value}. Expected YYYY-MM-DD`,
        400,
        'VALIDATION_ERROR'
      );
    }
  }
}