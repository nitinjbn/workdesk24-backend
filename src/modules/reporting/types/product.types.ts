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
    productId?: number;
    productCode?: string;
    productName?: string;
    productCategoryId?: number;
    productBrandId?: number;
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