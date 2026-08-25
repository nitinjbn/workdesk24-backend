require('ts-node/register/transpile-only');

const test = require('node:test');
const assert = require('node:assert/strict');

const {
  calculateLeaveDayBreakdown,
  compareYmdDate,
  diffDays,
  enumerateYmdDates,
  isValidYmdDate,
} = require('../../src/modules/leave/services/leave-calculation.util');

test('leave calculation util validates date formats', () => {
  assert.equal(isValidYmdDate('2026-08-25'), true);
  assert.equal(isValidYmdDate('2026-02-30'), false);
  assert.equal(isValidYmdDate('25-08-2026'), false);
});

test('leave calculation util computes date spans and ordering', () => {
  assert.equal(compareYmdDate('2026-01-01', '2026-01-01'), 0);
  assert.equal(compareYmdDate('2026-01-01', '2026-01-02'), -1);
  assert.equal(compareYmdDate('2026-01-02', '2026-01-01'), 1);

  assert.equal(diffDays('2026-01-01', '2026-01-05'), 4);

  assert.deepEqual(enumerateYmdDates('2026-01-01', '2026-01-03'), [
    '2026-01-01',
    '2026-01-02',
    '2026-01-03',
  ]);
});

test('leave calculation util excludes holidays and applies half day correctly', () => {
  const result = calculateLeaveDayBreakdown({
    fromDate: '2026-12-24',
    tillDate: '2026-12-26',
    durationType: 'FULL_DAY',
    requestedDays: [
      { leaveDate: '2026-12-24', durationType: 'FULL_DAY' },
      { leaveDate: '2026-12-25', durationType: 'FULL_DAY' },
      { leaveDate: '2026-12-26', durationType: 'FIRST_HALF' },
    ],
    holidays: [
      { holidayDate: '2026-12-25', isOptional: 0 },
    ],
  });

  assert.equal(result.totalLeaveDays, 1.5);
  assert.equal(result.excludedHolidayCount, 1);
  assert.equal(result.workingDays, 2);

  const holidayRow = result.dayBreakdown.find((d) => d.date === '2026-12-25');
  assert(holidayRow, 'Expected holiday row for 2026-12-25');
  assert.equal(holidayRow.excludedByHoliday, true);
  assert.equal(holidayRow.durationDays, 0);
});

test('leave calculation util excludes optional holiday only when selected', () => {
  const withOptionalExclusion = calculateLeaveDayBreakdown({
    fromDate: '2026-11-14',
    tillDate: '2026-11-14',
    durationType: 'FULL_DAY',
    holidays: [{ holidayDate: '2026-11-14', isOptional: 1 }],
    selectedOptionalHolidayDates: ['2026-11-14'],
  });

  assert.equal(withOptionalExclusion.totalLeaveDays, 0);

  const withoutOptionalExclusion = calculateLeaveDayBreakdown({
    fromDate: '2026-11-14',
    tillDate: '2026-11-14',
    durationType: 'FULL_DAY',
    holidays: [{ holidayDate: '2026-11-14', isOptional: 1 }],
    selectedOptionalHolidayDates: [],
  });

  assert.equal(withoutOptionalExclusion.totalLeaveDays, 1);
});
