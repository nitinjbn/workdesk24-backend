export interface DashboardConfig {
  overviewTodayTtl: number;
  overviewRangeTtl: number;
  overviewVersionTtl: number;
}

const DEFAULT_OVERVIEW_TODAY_TTL = 60;
const DEFAULT_OVERVIEW_RANGE_TTL = 600;
const DEFAULT_OVERVIEW_VERSION_TTL = 30 * 24 * 60 * 60;

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return defaultValue;
  }

  return parsedValue;
}

export const dashboardConfig: DashboardConfig = {
  overviewTodayTtl: parsePositiveInteger(process.env.DASHBOARD_OVERVIEW_TODAY_TTL, DEFAULT_OVERVIEW_TODAY_TTL),
  overviewRangeTtl: parsePositiveInteger(process.env.DASHBOARD_OVERVIEW_RANGE_TTL, DEFAULT_OVERVIEW_RANGE_TTL),
  overviewVersionTtl: parsePositiveInteger(process.env.DASHBOARD_OVERVIEW_VERSION_TTL, DEFAULT_OVERVIEW_VERSION_TTL),
};

export default dashboardConfig;