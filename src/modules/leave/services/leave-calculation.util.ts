import { LeaveDayBreakdown, LeaveDurationType, RequestedLeaveDay } from './leave-calculation.types';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export function isValidYmdDate(value: string): boolean {
  if (!DATE_REGEX.test(value)) {
    return false;
  }

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) {
    return false;
  }

  return date.toISOString().slice(0, 10) === value;
}

export function compareYmdDate(a: string, b: string): number {
  if (a === b) return 0;
  return a < b ? -1 : 1;
}

export function getTodayYmd(): string {
  return new Date().toISOString().slice(0, 10);
}

export function enumerateYmdDates(fromDate: string, tillDate: string): string[] {
  const dates: string[] = [];
  const current = new Date(`${fromDate}T00:00:00.000Z`);
  const end = new Date(`${tillDate}T00:00:00.000Z`);

  while (current <= end) {
    dates.push(current.toISOString().slice(0, 10));
    current.setUTCDate(current.getUTCDate() + 1);
  }

  return dates;
}

export function diffDays(fromDate: string, tillDate: string): number {
  const from = new Date(`${fromDate}T00:00:00.000Z`).getTime();
  const till = new Date(`${tillDate}T00:00:00.000Z`).getTime();
  return Math.floor((till - from) / (24 * 60 * 60 * 1000));
}

function getDurationForDate(payload: {
  date: string;
  allDatesCount: number;
  durationType: LeaveDurationType;
}): number {
  const { allDatesCount, durationType } = payload;

  if (allDatesCount > 1) {
    return 1;
  }

  if (durationType === 'FIRST_HALF' || durationType === 'SECOND_HALF') {
    return 0.5;
  }

  return 1;
}

export function calculateLeaveDayBreakdown(payload: {
  fromDate: string;
  tillDate: string;
  durationType: LeaveDurationType;
  requestedDays?: RequestedLeaveDay[];
  holidays: Array<{ holidayDate: string; isOptional: number }>;
  selectedOptionalHolidayDates?: string[];
}): {
  totalLeaveDays: number;
  workingDays: number;
  excludedHolidayCount: number;
  dayBreakdown: LeaveDayBreakdown[];
} {
  const {
    fromDate,
    tillDate,
    durationType,
    requestedDays,
    holidays,
    selectedOptionalHolidayDates,
  } = payload;

  const holidayMap = new Map<string, { isOptional: number }>();
  holidays.forEach((holiday) => {
    holidayMap.set(holiday.holidayDate, { isOptional: holiday.isOptional });
  });

  const selectedOptionalSet = new Set(selectedOptionalHolidayDates || []);
  const dates = enumerateYmdDates(fromDate, tillDate);

  const requestedDayDurationMap = new Map<string, number>();
  if (requestedDays && requestedDays.length > 0) {
    requestedDays.forEach((day) => {
      if (day.durationType === 'FULL_DAY') {
        requestedDayDurationMap.set(day.leaveDate, 1);
      } else {
        requestedDayDurationMap.set(day.leaveDate, 0.5);
      }
    });
  }

  const dayBreakdown: LeaveDayBreakdown[] = [];
  let totalLeaveDays = 0;
  let workingDays = 0;
  let excludedHolidayCount = 0;

  for (const date of dates) {
    const holiday = holidayMap.get(date);
    const baseDuration = requestedDayDurationMap.size > 0
      ? (requestedDayDurationMap.get(date) || 0)
      : getDurationForDate({
          date,
          allDatesCount: dates.length,
          durationType,
        });

    let excludedByHoliday = false;
    let isHoliday = false;
    let isOptionalHoliday = false;

    if (holiday) {
      isHoliday = true;
      isOptionalHoliday = Number(holiday.isOptional) === 1;

      if (!isOptionalHoliday) {
        excludedByHoliday = true;
      } else if (selectedOptionalSet.has(date)) {
        excludedByHoliday = true;
      }
    }

    const appliedDuration = excludedByHoliday ? 0 : baseDuration;

    if (excludedByHoliday) {
      excludedHolidayCount += 1;
    } else {
      workingDays += 1;
      totalLeaveDays += appliedDuration;
    }

    dayBreakdown.push({
      date,
      durationDays: appliedDuration,
      isHoliday,
      isOptionalHoliday,
      excludedByHoliday,
    });
  }

  return {
    totalLeaveDays: Number(totalLeaveDays.toFixed(2)),
    workingDays,
    excludedHolidayCount,
    dayBreakdown,
  };
}
