export interface ReportPaginationParams {
  page?: number;
  limit?: number;
}

export type ReportSortDirectionInput = 'ASC' | 'DESC' | 'asc' | 'desc';
export type ReportSortDirection = 'ASC' | 'DESC';

export interface ReportSortParams {
  sortBy?: string;
  sortOrder?: ReportSortDirectionInput;
  sort?: {
    by?: string;
    order?: ReportSortDirectionInput;
  };
}

export interface ReportPaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  nextPage: number | null;
  previousPage: number | null;
}

export type ReportResponse<T, K extends string = 'data'> = {
  [P in K]: T[];
} & {
  pagination?: ReportPaginationMeta;
};

export type SingleRecordResponse<T, K extends string = 'data'> = {
  [P in K]: T | Record<string, never>;
};

export type GpsHistoryReportResponse<T> = ReportResponse<T, 'gpsHistory'>;
export type AttendanceReportResponse<T> = ReportResponse<T, 'attendance'>;

export interface CreatedAtRangeFilter {
  from?: number | string;
  to?: number | string;
  start?: number | string;
  end?: number | string;
  gte?: number | string;
  lte?: number | string;
  eq?: number | string;
}

export interface UserScopedReportFilter {
  userId?: number | string;
  createdAt?: number | string | CreatedAtRangeFilter;
  [key: string]: unknown;
}

export interface UserScopedReportPayload extends ReportPaginationParams, ReportSortParams {
  hostId?: number | string;
  userId?: number | string;
  createdAt?: number | string | CreatedAtRangeFilter;
  filter?: UserScopedReportFilter;
}

export type CommonReportSortBy = 'createdAt' | 'batteryPercentage' | 'speed' | 'userName';

export interface CommonReportSorting {
  sortBy: CommonReportSortBy;
  sortOrder: ReportSortDirection;
}

export type GpsHistoryReportFilter = UserScopedReportFilter;

export interface GpsHistoryReportPayload extends UserScopedReportPayload {}

export interface AdminGpsHistoryFilter {
  userId?: number | string;
  fromDate?: number | string;
  tillDate?: number | string;
}

export interface AdminGpsJourneyEventFilter {
  type?: 'ATTENDANCE' | 'VISIT' | 'DAYOVER';
  id?: number | string;
  timestamp?: number | string;
  time?: number | string;
}

export interface AdminGpsHistoryJourneyFilter {
  userId?: number | string;
  startEvent?: AdminGpsJourneyEventFilter;
  endEvent?: AdminGpsJourneyEventFilter;
}

export interface AdminGpsHistoryJourneyPayload {
  hostId?: number | string;
  filter?: AdminGpsHistoryJourneyFilter;
}

export interface AdminGpsHistoryPayload {
  hostId?: number | string;
  filter?: AdminGpsHistoryFilter;
}

export interface AdminGpsHistoryEmployee {
  userId: number;
  code: string;
  name: string;
  designation: string;
  mobileNumber: string;
  profileImageUrl: string;
}

export interface AdminGpsHistorySummary {
  attendanceTime: number | null;
  dayoverTime: number | null;
  workingMinutes: number;
  totalDistanceKm: number;
  visitCount: number;
  orderCount: number;
  paymentCount: number;
  feedbackCount: number;
  imageCount: number;
}

export interface AdminGpsHistoryJourneyEvent {
  type: 'ATTENDANCE' | 'VISIT' | 'DAYOVER';
  id: number;
  time: number;
  timestamp: number;
  latitude: number;
  longitude: number;
  address?: string;
  title?: string;
}

export interface AdminGpsHistoryJourney {
  journeyId: number;
  title: string;
  distanceKm: number;
  durationMinutes: number;
  gpsPointCount?: number;
  routeType: 'ESTIMATED';
  startEvent: AdminGpsHistoryJourneyEvent;
  endEvent: AdminGpsHistoryJourneyEvent;
}

export interface AdminGpsHistoryMapBounds {
  north: number;
  south: number;
  east: number;
  west: number;
}

export interface AdminGpsHistoryResponse {
  employee: AdminGpsHistoryEmployee;
  summary: AdminGpsHistorySummary;
  journeys: AdminGpsHistoryJourney[];
  mapBounds: AdminGpsHistoryMapBounds;
}

export interface AdminGpsHistoryJourneySummary {
  distanceKm: number;
  durationMinutes: number;
  travelMinutes: number;
  idleMinutes: number;
  averageSpeed: number;
  maximumSpeed: number;
}

export interface AdminGpsHistoryJourneyPoint {
  time: number | string;
  timestamp: number;
  latitude: number;
  longitude: number;
  accuracy: number;
  speed: number;
  provider: string;
}

export interface AdminGpsHistoryJourneyResponse {
  summary: AdminGpsHistoryJourneySummary;
  gpsPoints: AdminGpsHistoryJourneyPoint[];
}

export type AttendanceReportFilter = UserScopedReportFilter;

export interface AttendanceReportPayload extends UserScopedReportPayload {}

export interface ReportScope {
  hostId: number;
  requestUserId?: number;
}

export interface GetVisitsReportPayload extends ReportPaginationParams, ReportSortParams {
  hostId: number;
  filter?: {
    userId?: number;
    customerId?: number;
    customerName?: string;
    checkInTime?: {
      from?: number;
      to?: number;
    };
    checkOutTime?: {
      from?: number;
      to?: number;
    };
  };
  sortBy?: string;
  sortOrder?: ReportSortDirectionInput;
  sorting?: {
    by?: string;
    order?: ReportSortDirectionInput;
  };
}

export interface GetOrdersReportPayload extends ReportPaginationParams, ReportSortParams {
  hostId: number;
  filter?: {
    userId?: number;
    customerId?: number;
    customerName?: string;
    orderTime?: {
      from?: number;
      to?: number;
    };
    visitId?: number;
  };
  sortBy?: string;
  sortOrder?: ReportSortDirectionInput;
  sorting?: {
    by?: string;
    order?: ReportSortDirectionInput;
  };
}

export interface GetPaymentsReportPayload extends ReportPaginationParams, ReportSortParams {
  hostId: number;
  filter?: {
    userId?: number;
    customerId?: number;
    customerName?: string;
    paymentCaptureTime?: {
      from?: number;
      to?: number;
    };
    visitId?: number;
  };
  sortBy?: string;
  sortOrder?: ReportSortDirectionInput;
  sorting?: {
    by?: string;
    order?: ReportSortDirectionInput;
  };
}

export interface GetFeedbacksReportPayload extends ReportPaginationParams, ReportSortParams {
  hostId: number;
  filter?: {
    userId?: number;
    customerId?: number;
    customerName?: string;
    feedbackTime?: {
      from?: number;
      to?: number;
    };
    visitId?: number;
  };
  sortBy?: string;
  sortOrder?: ReportSortDirectionInput;
  sorting?: {
    by?: string;
    order?: ReportSortDirectionInput;
  };
}

export interface GetImagesReportPayload extends ReportPaginationParams, ReportSortParams {
  hostId: number;
  filter?: {
    userId?: number;
    customerId?: number;
    customerName?: string;
    capturedAt?: {
      from?: number;
      to?: number;
    };
    visitId?: number;
  };
  sortBy?: string;
  sortOrder?: ReportSortDirectionInput;
  sorting?: {
    by?: string;
    order?: ReportSortDirectionInput;
  };
}