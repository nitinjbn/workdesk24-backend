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

export interface ReportResponse<T> {
  data: T[];
  pagination?: ReportPaginationMeta;
}

export interface SingleRecordResponse<T> {
  data: {};
}

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

export interface GetUsersPayload extends ReportPaginationParams, ReportSortParams {
  hostId?: number;
  filter?: GetUsersFilter;
}

export interface GetUsersFilter {
  id?: number,
  userId?: number,
  employeeId?: string,
  name?: string,
  email?: string,
  mobile?: number,
  isActive?: boolean,
  roleCode?: string[],
  searchKey?: string
}

export interface GetRolesPayload {
  hostId: number;
  page?: number;
  limit?: number;
  filter?: {
    id?: number;
    roleId?: number;
    roleCode?: string;
    roleName?: string;
  };
  sortBy: CommonReportSortBy;
  sortOrder: ReportSortDirection;
}

export interface GetRoleDetailsByIdPayload {
  hostId: number;
  roleId: number;
} 

export interface ReportScope {
  hostId: number;
  requestUserId?: number;
}