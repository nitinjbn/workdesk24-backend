export type CronFrequency =
  | 'daily'
  | 'weekdays'
  | 'weekly'
  | 'monthly'
  | 'yearly'
  | 'interval';

export type CronWeekday =
  | 'sunday'
  | 'monday'
  | 'tuesday'
  | 'wednesday'
  | 'thursday'
  | 'friday'
  | 'saturday';

export type CronMonth = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 | 9 | 10 | 11 | 12;

export interface DailyCronOptions {
  frequency: 'daily';
  time: string;
}

export interface WeekdayCronOptions {
  frequency: 'weekdays';
  time: string;
}

export interface WeeklyCronOptions {
  frequency: 'weekly';
  day: CronWeekday | number;
  time: string;
}

export interface MonthlyCronOptions {
  frequency: 'monthly';
  day: number;
  time: string;
}

export interface YearlyCronOptions {
  frequency: 'yearly';
  month: CronMonth | number;
  day: number;
  time: string;
}

export interface IntervalCronOptions {
  frequency: 'interval';
  unit: 'minutes' | 'hours' | 'days';
  every: number;
}

export type CronOptions =
  | DailyCronOptions
  | WeekdayCronOptions
  | WeeklyCronOptions
  | MonthlyCronOptions
  | YearlyCronOptions
  | IntervalCronOptions;

export class CronHelper {
  private static readonly WEEKDAY_MAP: Record<CronWeekday, number> = {
    sunday: 0,
    monday: 1,
    tuesday: 2,
    wednesday: 3,
    thursday: 4,
    friday: 5,
    saturday: 6,
  };

  /**
   * Convert a typed schedule definition into a standard
   * 5-field cron expression.
   *
   * Examples:
   *
   * Daily:
   *   { frequency: 'daily', time: '01:00' }
   *   => '0 1 * * *'
   *
   * Weekdays:
   *   { frequency: 'weekdays', time: '09:30' }
   *   => '30 9 * * 1-5'
   *
   * Weekly:
   *   { frequency: 'weekly', day: 'monday', time: '09:00' }
   *   => '0 9 * * 1'
   *
   * Monthly:
   *   { frequency: 'monthly', day: 15, time: '18:00' }
   *   => '0 18 15 * *'
   *
   * Yearly:
   *   { frequency: 'yearly', month: 1, day: 1, time: '00:00' }
   *   => '0 0 1 1 *'
   */
  static toCron(options: CronOptions): string {
    switch (options.frequency) {
      case 'daily':
        return this.buildDaily(options.time);

      case 'weekdays':
        return this.buildWeekdays(options.time);

      case 'weekly':
        return this.buildWeekly(options.day, options.time);

      case 'monthly':
        return this.buildMonthly(options.day, options.time);

      case 'yearly':
        return this.buildYearly(
          options.month,
          options.day,
          options.time,
        );

      case 'interval':
        return this.buildInterval(
          options.every,
          options.unit,
        );

      default:
        return this.assertNever(options);
    }
  }

  /**
   * Daily at a specific time.
   *
   * 01:00   => 0 1 * * *
   * 13:30   => 30 13 * * *
   * 1:30 PM => 30 13 * * *
   */
  private static buildDaily(time: string): string {
    const { minute, hour } = this.parseTime(time);

    return `${minute} ${hour} * * *`;
  }

  /**
   * Monday-Friday at a specific time.
   *
   * 09:00 => 0 9 * * 1-5
   */
  private static buildWeekdays(time: string): string {
    const { minute, hour } = this.parseTime(time);

    return `${minute} ${hour} * * 1-5`;
  }

  /**
   * Weekly on a specific day and time.
   *
   * Monday 09:00   => 0 9 * * 1
   * Sunday 11:30PM => 30 23 * * 0
   */
  private static buildWeekly(
    day: CronWeekday | number,
    time: string,
  ): string {
    const { minute, hour } = this.parseTime(time);
    const weekday = this.parseWeekday(day);

    return `${minute} ${hour} * * ${weekday}`;
  }

  /**
   * Monthly on a specific day and time.
   *
   * 15th at 09:00 => 0 9 15 * *
   *
   * Note:
   * Monthly schedules for days such as 29, 30, or 31
   * naturally do not run in months where that day does not exist.
   */
  private static buildMonthly(
    day: number,
    time: string,
  ): string {
    const { minute, hour } = this.parseTime(time);

    this.validateDay(day);

    return `${minute} ${hour} ${day} * *`;
  }

  /**
   * Yearly on a specific month, day and time.
   *
   * January 1st at midnight:
   * 0 0 1 1 *
   *
   * February 29th is allowed because it is valid during
   * leap years. The scheduler naturally will not execute
   * on non-leap years.
   */
  private static buildYearly(
    month: number,
    day: number,
    time: string,
  ): string {
    const { minute, hour } = this.parseTime(time);

    this.validateMonth(month);
    this.validateDayForMonth(month, day);

    return `${minute} ${hour} ${day} ${month} *`;
  }


//    Interval schedules.
//    *
//    * Every 5 minutes:
//    *   */5 * * * *
//    *
//    * Every 2 hours:
//    *   0 */2 * * *
//    *
//    * Every 3 days:
//    *   0 0 */3 * *
//    *
//    * Important:
//    * "Every N days" using cron is not a true rolling interval.
//    * It is based on day-of-month and therefore resets each month.
//    *
  private static buildInterval(
    every: number,
    unit: 'minutes' | 'hours' | 'days',
  ): string {
    if (!Number.isInteger(every) || every <= 0) {
      throw new Error(
        `Invalid interval "${every}". Expected a positive integer.`,
      );
    }

    switch (unit) {
      case 'minutes':
        if (every > 59) {
          throw new Error(
            'Minute interval must be between 1 and 59.',
          );
        }

        return `*/${every} * * * *`;

      case 'hours':
        if (every > 23) {
          throw new Error(
            'Hour interval must be between 1 and 23.',
          );
        }

        return `0 */${every} * * *`;

      case 'days':
        if (every > 31) {
          throw new Error(
            'Day interval must be between 1 and 31.',
          );
        }

        return `0 0 */${every} * *`;

      default:
        return this.assertNever(unit);
    }
  }

  /**
   * Parse both 12-hour and 24-hour time formats.
   *
   * Supported:
   *   01:30
   *   13:30
   *   1:30 AM
   *   1:30 PM
   *   1 AM
   *   12 PM
   */
  private static parseTime(time: string): {
    hour: number;
    minute: number;
  } {
    if (typeof time !== 'string' || !time.trim()) {
      throw new Error('Time is required.');
    }

    const normalized = time.trim().toUpperCase();

    const match = normalized.match(
      /^(\d{1,2})(?::(\d{2}))?\s*(AM|PM)?$/,
    );

    if (!match) {
      throw new Error(
        `Invalid time "${time}". Expected HH:mm, H:mm AM/PM, or H AM/PM.`,
      );
    }

    let hour = Number(match[1]);

    const minute =
      match[2] !== undefined
        ? Number(match[2])
        : 0;

    const meridiem = match[3];

    if (minute < 0 || minute > 59) {
      throw new Error(
        `Invalid minute "${minute}". Expected 0-59.`,
      );
    }

    if (meridiem) {
      if (hour < 1 || hour > 12) {
        throw new Error(
          `Invalid 12-hour time "${time}". Hour must be 1-12.`,
        );
      }

      if (meridiem === 'AM') {
        hour = hour === 12 ? 0 : hour;
      } else {
        hour = hour === 12 ? 12 : hour + 12;
      }
    } else {
      if (hour < 0 || hour > 23) {
        throw new Error(
          `Invalid 24-hour time "${time}". Hour must be 0-23.`,
        );
      }
    }

    return {
      hour,
      minute,
    };
  }

  /**
   * Convert weekday name/number to cron weekday.
   *
   * Sunday = 0
   * Monday = 1
   * ...
   * Saturday = 6
   */
  private static parseWeekday(
    day: CronWeekday | number,
  ): number {
    if (typeof day === 'number') {
      if (!Number.isInteger(day) || day < 0 || day > 6) {
        throw new Error(
          `Invalid weekday "${day}". Expected 0-6.`,
        );
      }

      return day;
    }

    const normalized = day.trim().toLowerCase() as CronWeekday;

    const weekday = this.WEEKDAY_MAP[normalized];

    if (weekday === undefined) {
      throw new Error(
        `Invalid weekday "${day}". Expected Sunday-Saturday.`,
      );
    }

    return weekday;
  }

  /**
   * Validate a generic calendar day.
   */
  private static validateDay(day: number): void {
    if (!Number.isInteger(day) || day < 1 || day > 31) {
      throw new Error(
        `Invalid day "${day}". Expected an integer between 1 and 31.`,
      );
    }
  }

  /**
   * Validate month.
   */
  private static validateMonth(month: number): void {
    if (!Number.isInteger(month) || month < 1 || month > 12) {
      throw new Error(
        `Invalid month "${month}". Expected an integer between 1 and 12.`,
      );
    }
  }

  /**
   * Validate that a day exists in the specified month.
   *
   * February 29 is allowed because it exists in leap years.
   */
  private static validateDayForMonth(
    month: number,
    day: number,
  ): void {
    this.validateDay(day);

    const daysInMonth: Record<number, number> = {
      1: 31,
      2: 29,
      3: 31,
      4: 30,
      5: 31,
      6: 30,
      7: 31,
      8: 31,
      9: 30,
      10: 31,
      11: 30,
      12: 31,
    };

    const maxDay = daysInMonth[month];

    if (day > maxDay) {
      throw new Error(
        `Invalid date: month ${month} does not have day ${day}.`,
      );
    }
  }

  private static assertNever(value: never): never {
    throw new Error(
      `Unsupported cron configuration: ${String(value)}`,
    );
  }
}

//Usage daily at 1 AM
/*
CronHelper.toCron({
  frequency: 'daily',
  time: '1:00 AM',
});
//Output: '0 1 * * *'

//Usage daily at 1:30 PM
CronHelper.toCron({
  frequency: 'daily',
  time: '13:30',
});
// Output: '30 13 * * *'

//Usage weekdays at 9 AM
CronHelper.toCron({
  frequency: 'weekdays',
  time: '9:00 AM',
});
// Output: '0 9 * * 1-5'

//Usage weekly on Monday at 9:00 AM
CronHelper.toCron({
  frequency: 'weekly',
  day: 'monday',
  time: '9:00 AM',
});
// Output: '0 9 * * 1'

//Usage weekly on Sunday at 11:30 PM
CronHelper.toCron({
  frequency: 'weekly',
  day: 'sunday',
  time: '11:30 PM',
});
// Output: '30 23 * * 0'

//Usage monthly on the 15th at 10:00 AM
CronHelper.toCron({
  frequency: 'monthly',
  day: 15,
  time: '10:00 AM',
});
// Output: '0 10 15 * *'

//Usage interval every 5 minutes
CronHelper.toCron({
  frequency: 'interval',
  every: 5,
  unit: 'minutes',
});
*/
// Output: '*/5 * * * *'

//Usage interval every 2 hours
/*
CronHelper.toCron({
  frequency: 'interval',
  every: 2,
  unit: 'hours',
});
*/
// Output: '0 */2 * * *'

//Usage interval every year on January 1st at midnight
/*
CronHelper.toCron({
  frequency: 'yearly',
  month: 1,
  day: 1,
  time: '12:00 AM',
});
// Output: '0 0 1 1 *'

//Usage interval every year on December 31st at 11:59 PM
CronHelper.toCron({
  frequency: 'yearly',
  month: 12,
  day: 31,
  time: '11:59 PM',
});
*/
// Output: '59 23 31 12 *'