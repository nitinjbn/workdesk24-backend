import productRepository from '../repositories/product.repository';
import {
  GetProductsPayload,
  GetProductDetailsByIdPayload,
  ReportResponse,
  ProductDetailsResponse,
  CommonReportSorting,
  CommonReportSortBy,
  ReportScope,
  GetProductsReportResponse,
  ProductMediaResponse,
  ProductAttributesResponse,
  SaveProductMediaPayload
} from '../types/product.types';
import { Product } from '../../../models/schemas';
import baseReportHelper from '../helpers/base-report.helper';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { CONFIG } from '../../../config/constants';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

type ProductInstance = typeof Product.prototype;

export class ProductService {
  async getCategories(
    payload: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sorting?: CommonReportSorting },
    scope: ReportScope
  ): Promise<{ categories: any[], pagination?: any }> {
    
    const { hostId, filter, page, limit } = payload;
    const sorting = this.normalizeCommonSorting(payload);

    const report = await productRepository.getCategories({
      hostId,
      page,
      limit,
      filter,
      sortBy: sorting?.sortBy,
      sortOrder: sorting?.sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      categories: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getBrands(
    payload: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sorting?: CommonReportSorting },
    scope: ReportScope
  ): Promise<{ brands: any[], pagination?: any }> {
    
    const { hostId, filter, page, limit } = payload;
    const sorting = this.normalizeCommonSorting(payload);

    const report = await productRepository.getBrands({
      hostId,
      page,
      limit,
      filter,
      sortBy: sorting?.sortBy,
      sortOrder: sorting?.sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      brands: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getProducts(
    payload: GetProductsPayload,
    scope: ReportScope
  ): Promise<GetProductsReportResponse<ProductInstance>> {
    const { page, limit } = baseReportHelper.normalizePagination(payload);
    //const filter = this.normalizeProductFilter(payload);
    //const hostId = this.resolveRequiredHostId(payload.hostId, scope.hostId);
    //const userId = this.resolveEffectiveUserId(filter, scope);
    //const enforceActiveUsersOnly = userId === undefined;
    const sorting = this.normalizeCommonSorting(payload);
    //const { page, limit } = payload; // Commented because pagination is mandatory for this report and if not provided, it will default to page 1 and limit 10 in the repository.

    const { hostId, filter } = payload;
    const report = await productRepository.getProducts({
      hostId,
      page,
      limit,
      filter,
      sortBy: sorting.sortBy,
      sortOrder: sorting.sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      products: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getProductDetails(
    payload: { hostId: number, productId: number },
    scope: ReportScope
  ): Promise<ProductDetailsResponse<ProductInstance>> {
    let { hostId, productId } = payload;

    const productDetails = await productRepository.getProductById({
      hostId,
      productId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = productDetails?.data && typeof productDetails.data.toJSON === 'function' 
      ? productDetails.data.toJSON() 
      : productDetails?.data;
    return {
      product: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  async getProductMedia(
    payload: { hostId: number, productId: number },
    scope: ReportScope
  ): Promise<ProductMediaResponse<ProductInstance>> {
    let { hostId, productId } = payload;

    const productMedia = await productRepository.getProductMedia({
      hostId,
      productId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = productMedia?.data && typeof productMedia.data.toJSON === 'function' 
      ? productMedia.data.toJSON() 
      : productMedia?.data;
    return {
      media: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  async getProductAttributes(
    payload: { hostId: number, productId: number },
    scope: ReportScope
  ): Promise<ProductAttributesResponse<ProductInstance>> {
    let { hostId, productId } = payload;

    const productAttributes = await productRepository.getProductAttributes({
      hostId,
      productId
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = productAttributes?.data && typeof productAttributes.data.toJSON === 'function' 
      ? productAttributes.data.toJSON() 
      : productAttributes?.data;
    return {
      attributes: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  private normalizeCommonSorting(payload: GetProductsPayload): { sortBy: string, sortOrder: "ASC" | "DESC" } {
    const requestedSortBy = payload.sort?.by || payload.sortBy;
    const requestedSortOrder = payload.sort?.order || payload.sortOrder;

    return {
      sortBy: requestedSortBy,
      sortOrder: requestedSortOrder as "ASC" | "DESC"
    }

    // const allowedSortBy: CommonReportSortBy[] = [
    //   'createdAt',
    //   'batteryPercentage',
    //   'speed',
    //   'userName',
    // ];

    // const sortBy = allowedSortBy.includes(requestedSortBy as any)
    //   ? (requestedSortBy as CommonReportSortBy)
    //   : 'createdAt';

    // return {
    //   sortBy,
    //   sortOrder: baseReportHelper.normalizeSortDirection(requestedSortOrder),
    // };
  }

  async saveProductMedia(payload: SaveProductMediaPayload): Promise<any> {
    console.log('############################# saveProductMedia payload:', payload);
    const { hostId, productId, mediaUrl, mediaType, publicId, fileName, fileSizeInBytes, mimeType, isPrimary, sortOrder, isEnabled  } = payload;
      const result = await productRepository.saveProductMedia({
        hostId,
        productId,
        mediaUrl,
        mediaType,
        publicId,
        fileName,
        fileSizeInBytes,
        mimeType,
        isPrimary,
        sortOrder,
        isEnabled,
        createdAt: DateTimeFormatUtil.getCurrentUnixTime()
      });

    return result;
  }
}

export default new ProductService();