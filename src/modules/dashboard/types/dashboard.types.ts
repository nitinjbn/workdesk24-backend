export type DashboardDatePreset = 'today' | 'yesterday' | 'this_week' | 'last_week' | 'this_month' | 'last_month';
export type DashboardTrendGranularity = 'day' | 'month';

export interface DashboardDateFilter {
  type: 'preset' | 'custom';
  value?: DashboardDatePreset;
  startDate?: string;
  endDate?: string;
}

export interface DashboardEntityFilter {
  ids: number[];
}

export interface DashboardOverviewFilter {
  date?: DashboardDateFilter;
  createdAt?: {
    from?: number;
    to?: number;
  };
  employees?: DashboardEntityFilter;
  users?: DashboardEntityFilter;
  teams?: DashboardEntityFilter;
  employeeIds?: number[];
  userIds?: number[];
  teamIds?: number[];
  userId?: number;
}

export interface DashboardOverviewOptions {
  trendGranularity?: DashboardTrendGranularity;
  topPerformersLimit?: number;
  activityLimit?: number;
  includeActivity?: boolean;
}

export interface DashboardOverviewRequest {
  filter?: DashboardOverviewFilter;
  options?: DashboardOverviewOptions;
}

export interface DashboardResolvedDateRange {
  preset?: DashboardDatePreset | 'custom' | 'unix_range';
  startDate: string;
  endDate: string;
  startUnix: number;
  endUnix: number;
  startDateTime: string;
  endDateTime: string;
  timezone: string;
}

export interface DashboardResolvedFilters {
  employeeIds?: number[];
  teamIds?: number[];
}

export interface DashboardTrendPoint {
  date: string;
  totalEmployees?: number;
  present?: number;
  absent?: number;
  onLeave?: number;
  attendancePercentage?: number;
  totalVisits?: number;
  totalOrders?: number;
  totalOrderAmount?: number;
  totalPayments?: number;
  totalPaymentAmount?: number;
  totalFeedback?: number;
  totalUploaded?: number;
}

export interface DashboardOverviewContext {
  hostId: number;
  requestUserId: number;
  request: DashboardOverviewRequest;
}

export interface DashboardStatusBreakdown {
  available: boolean;
  items?: Array<{ status: string; count: number; amount?: number }>;
  reason?: string;
}

export interface DashboardOverviewResponse {
  meta: {
    hostId: number;
    timezone: string;
    range: {
      preset?: string;
      startDate: string;
      endDate: string;
      startTime: number;
      endTime: number;
      granularity: DashboardTrendGranularity;
    };
    generatedAt: number;
    cache: {
      key: string;
      ttlSeconds: number;
      hit: boolean;
      source: 'cache' | 'database';
    };
    filters: DashboardResolvedFilters;
  };
  kpis: {
    totalEmployees: number;
    presentToday: number;
    attendancePercentage: number;
    totalVisits: number;
    totalOrders: number;
    totalPaymentAmount: number;
    pendingDayovers: number;
  };
  attendance: {
    present: number;
    absent: number;
    onLeave: number;
    dayoverPending: number;
    trend: DashboardTrendPoint[];
  };
  visits: {
    totalVisits: number;
    statusBreakdown: DashboardStatusBreakdown;
    trend: DashboardTrendPoint[];
  };
  orders: {
    totalOrders: number;
    statusBreakdown: DashboardStatusBreakdown;
    trend: DashboardTrendPoint[];
  };
  payments: {
    totalAmount: number;
    received: number;
    pending: number | null;
    failed: number | null;
    statusBreakdown: DashboardStatusBreakdown;
    trend: DashboardTrendPoint[];
  };
  feedback: {
    totalFeedback: number;
    ratingBreakdown: DashboardStatusBreakdown;
    trend: DashboardTrendPoint[];
  };
  images: {
    totalUploaded: number;
    trend: DashboardTrendPoint[];
  };
  dayover: {
    completed: number;
    pending: number;
    missing: number;
  };
  performance: {
    overall: unknown[];
    byVisits: unknown[];
    byOrders: unknown[];
    byPayments: unknown[];
  };
  activity?: {
    items: unknown[];
  };
}