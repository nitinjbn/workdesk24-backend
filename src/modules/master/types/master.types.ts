export interface ReportPaginationParams {
  page?: number;
  limit?: number;
}

export interface ReportScope {
  hostId: number;
  requestUserId?: number;
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

export type GetProductsReportResponse<T> = ReportResponse<T, 'products'>;
export type ProductDetailsResponse<T> = SingleRecordResponse<T, 'product'>;
export type ProductMediaResponse<T> = SingleRecordResponse<T, 'media'>;
export type ProductAttributesResponse<T> = SingleRecordResponse<T, 'attributes'>;
export type UsersReportResponse<T> = ReportResponse<T, 'users'>;
export type DesignationsReportResponse<T> = ReportResponse<T, 'designations'>;
export type UserDetailsResponse<T> = SingleRecordResponse<T, 'user'>;
export type RolesReportResponse<T> = ReportResponse<T, 'roles'>;

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
  accountStatus?: 'ACTIVE' | 'INACTIVE',
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

export interface GetRoleDetailsByIdPayload {
  hostId: number;
  roleId: number;
} 

export interface GetRoleDetailsByCodePayload {
  hostId: number;
  roleCode: string;
}

export interface GetDesignationsPayload extends ReportPaginationParams, ReportSortParams {
  hostId?: number;
  filter?: {
    id?: number;
    name?: string;
    isEnabled?: boolean;
  };
}

export type CommonReportSortBy = 'createdAt' | 'batteryPercentage' | 'speed' | 'userName';

export interface CommonReportSorting {
  sortBy: CommonReportSortBy;
  sortOrder: ReportSortDirection;
}

export interface GetProductsPayload {
  hostId: number;
  page?: number;
  limit?: number;
  filter?: {
    id?: number;
    searchKey?: string;
    productId?: number;
    productCode?: string;
    productName?: string;
    categoryId?: number;
    brandId?: number;
    sku?: string;
    barCode?: string;
    hsnCode?: string;
  };
  sort?: {
    by?: string;
    order?: string;
  }
  sortBy?: string;
  sortOrder?: string;
}

export interface GetProductDetailsByIdPayload {
  hostId: number;
  productId: number;
} 

export interface GetProductMediaDetailsByIdPayload {
  hostId: number;
  productId: number;
  filter?: {
    id?: number;
    mediaId?: number;
    mediaType?: string;
    isEnabled?: boolean;
  }
}

export interface GetProductAttributesDetailsByIdPayload {
  hostId: number;
  productId: number;
  filter?: {
    id?: number;
    attributeId?: number;
    attributeType?: string;
    isEnabled?: boolean;
  }
}

export interface SaveProductMediaPayload {
  hostId: number;
  productId: number;
  mediaUrl: string;
  mediaType: "IMAGE" | "VIDEO" | "PDF" | "DOCUMENT" | "BROCHURE" | "CERTIFICATE" | "LABEL" | "MANUAL";
  publicId?: string;
  fileName?: string;
  fileSizeInBytes?: number;
  mimeType?: string;
  isPrimary?: number;
  sortOrder?: number;
  isEnabled?: number;
  createdAt?: number;
}

export interface SaveProductAttributePayload {
  hostId: number;
  productId: number;
  attributeName: string;
  attributeValue: string;
  isEnabled?: number;
  createdAt?: number;
}

export interface SaveProductAttributesPayload {
  hostId: number;
  productId: number;
  attributes: Array<{
    attributeGroup: string;
    attributeName: string;
    attributeValue: string;
    attributeType: 'TEXT' | 'NUMBER' | 'DECIMAL' | 'DATE' | 'BOOLEAN' | 'JSON';
    attributeUomId?: number;
    sortOrder?: number;
    isEnabled?: number;
  }>;
  createdAt?: number;
}