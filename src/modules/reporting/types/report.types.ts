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
  };
  sortBy?: string;
  sortOrder?: ReportSortDirectionInput;
  sorting?: {
    by?: string;
    order?: ReportSortDirectionInput;
  };
}