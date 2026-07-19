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
} from '../types/master.types';
import { Product } from '../../../models/schemas';
import baseReportHelper from '../helpers/base-report.helper';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { CONFIG } from '../../../config/constants';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';
import { deleteMediaFromStorage } from '../../../shared/utils/media-storage.util';

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

  async getUOM(
    payload: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sorting?: CommonReportSorting },
    scope: ReportScope
  ): Promise<{ uom: any[], pagination?: any }> {
    
    const { hostId, filter, page, limit } = payload;
    const sorting = this.normalizeCommonSorting(payload);

    const report = await productRepository.getUOM({
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
      uom: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
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

  private validateProduct(payload: any): void {
    const requiredFields = ['hostId', 'productName', 'sellingPrice', 'mrp'];
    for (const field of requiredFields) {
      if (!payload[field]) {
        throw createConfiguredError("VALIDATION_ERROR", `Missing required field: ${field}`);
      }
    }
  }

  async createProduct(payload: any, scope: ReportScope): Promise<any> {
    const { productMedia, productAttribute, ...otherPayload } = payload;
    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    // Validate required fields
    this.validateProduct(payload);

    const createProductResult = await productRepository.createProduct({
      hostId: otherPayload.hostId,
      productCode: otherPayload.productCode,
      productName: otherPayload.productName,
      shortName: otherPayload.shortName,
      categoryId: otherPayload.categoryId,
      brandId: otherPayload.brandId,
      uomId: otherPayload.uomId,
      sku: otherPayload.sku,
      barcode: otherPayload.barcode,
      hsnCode: otherPayload.hsnCode,
      purchasePrice: otherPayload.purchasePrice,
      sellingPrice: otherPayload.sellingPrice,
      mrp: otherPayload.mrp,
      taxPercentage: otherPayload.taxPercentage,
      remarks: otherPayload.remarks,
      isEnabled: otherPayload.isEnabled,
      createdAt: currentUnixTime
    });

    if (createProductResult?.id) {
      if (productMedia && Array.isArray(productMedia)) {
        //Now product is created, so we can save the media with the productId
        for (const media of productMedia) {
          await productRepository.updateProductMedia({
            updatePayload: {
              productId: createProductResult.id,
              isEnabled: media.isEnabled || 1, // Default to enabled if not provided
              updatedAt: currentUnixTime
            },
            where: {
              id: media.mediaId,
              hostId: otherPayload.hostId
            }
          });
        }
      }

      if (productAttribute && Array.isArray(productAttribute)) {
        // Now product is created, so we can save the attributes with the productId
        await productRepository.saveProductAttributes({
          hostId: otherPayload.hostId,
          productId: createProductResult.id,
          attributes: productAttribute,
          createdAt: currentUnixTime
        });
      }
    }

    return createProductResult;
  }

  async updateProduct(payload: any, scope: ReportScope): Promise<any> {
    const { productId, productMedia, productAttribute, ...otherPayload } = payload;
    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    // Validate required fields
    if (!productId) {
      throw createConfiguredError("VALIDATION_ERROR", 'Missing required field: productId');
    }

    // Validate other required fields for update
    this.validateProduct(payload);

    // Check if the product exists before updating
    const existingProduct = await productRepository.getProductById({
      hostId: otherPayload.hostId,
      productId: productId
    });
    if (!existingProduct || !existingProduct.data) {
      throw createConfiguredError("PRODUCT_NOT_FOUND", 'Product not found.');
    }

    const updateProductResult = await productRepository.updateProduct({
      updatePayload: {
        productCode: otherPayload.productCode,
        productName: otherPayload.productName,
        shortName: otherPayload.shortName,
        remarks: otherPayload.remarks,
        categoryId: otherPayload.categoryId,
        brandId: otherPayload.brandId,
        uomId: otherPayload.uomId,
        sku: otherPayload.sku,
        barcode: otherPayload.barcode,
        hsnCode: otherPayload.hsnCode,
        purchasePrice: otherPayload.purchasePrice,
        sellingPrice: otherPayload.sellingPrice,
        mrp: otherPayload.mrp,
        taxPercentage: otherPayload.taxPercentage,
        isEnabled: otherPayload.isEnabled !== undefined ? otherPayload.isEnabled : existingProduct.data.isEnabled,
        updatedAt: currentUnixTime
      },
      where: {
        id: productId,
        hostId: otherPayload.hostId
      }
    });

    // Handle Product Media - Add, Update, Delete
    if (productMedia || (existingProduct.data.productMedia && existingProduct.data.productMedia.length > 0)) {
      const existingMediaIds = existingProduct.data.productMedia?.map((m: any) => m.id) || [];
      const payloadMediaIds = productMedia?.map((m: any) => m.mediaId) || [];

      // Media to UPDATE (in both payload and existing)
      const mediaToUpdate = productMedia?.filter((m: any) => existingMediaIds.includes(m.mediaId)) || [];
      
      // Media to DELETE (in existing but not in payload)
      const mediaToDelete = existingProduct.data.productMedia?.filter((m: any) => !payloadMediaIds.includes(m.id)) || [];

      // Execute UPDATE operations
      for (const media of mediaToUpdate) {
        await productRepository.updateProductMedia({
          updatePayload: {
            productId: productId,
            isEnabled: media.isEnabled || 1,
            isPrimary: media.isPrimary || 0,
            sortOrder: media.sortOrder || 0,
            updatedAt: currentUnixTime
          },
          where: {
            id: media.mediaId,
            hostId: otherPayload.hostId
          }
        });
      }

      // Execute DELETE operations (soft delete)
      if (mediaToDelete.length > 0) {
        await productRepository.updateProductMedia({
          updatePayload: {
            isDeleted: 1,
            updatedAt: currentUnixTime
          },
          where: {
            id: mediaToDelete.map(m => m.id),
            hostId: otherPayload.hostId
          }
        });
      }
    }

    // Handle Product Attributes - Add, Update, Delete
    if (productAttribute || (existingProduct.data.productAttribute && existingProduct.data.productAttribute.length > 0)) {
      const existingAttributeIds = existingProduct.data.productAttribute?.map((a: any) => a.id) || [];
      const payloadAttributeIds = productAttribute?.map((a: any) => a.attributeId || a.id) || [];

      // Attributes to ADD (in payload but not in existing)
      const attributesToAdd = productAttribute?.filter((a: any) => !existingAttributeIds.includes(a.attributeId || a.id)) || [];
      if (attributesToAdd.length > 0) {
        await productRepository.saveProductAttributes({
          hostId: otherPayload.hostId,
          productId: productId,
          attributes: attributesToAdd,
          createdAt: currentUnixTime
        });
      }

      // Attributes to UPDATE (in both payload and existing)
      const attributesToUpdate = productAttribute?.filter((a: any) => existingAttributeIds.includes(a.attributeId || a.id)) || [];
      for (const attr of attributesToUpdate) {
        await productRepository.updateProductAttributes({
          updatePayload: {
            attributeGroup: attr.attributeGroup,
            attributeName: attr.attributeName,
            attributeValue: attr.attributeValue,
            attributeType: attr.attributeType,
            attributeUomId: attr.attributeUomId,
            isEnabled: attr.isEnabled !== undefined ? attr.isEnabled : 1,
            updatedAt: currentUnixTime
          },
          where: {
            id: attr.attributeId || attr.id,
            hostId: otherPayload.hostId
          }
        });
      }

      // Attributes to DELETE (in existing but not in payload)
      const attributesToDelete = existingProduct.data.productAttribute?.filter((a: any) => !payloadAttributeIds.includes(a.id)) || [];

      if(attributesToDelete.length > 0) {
        await productRepository.updateProductAttributes({
          updatePayload: {
            isDeleted: 1,
            deletedAt: currentUnixTime
          },
          where: {
            id: attributesToDelete.map(a => a.attributeId || a.id),
            hostId: otherPayload.hostId
          }
        });
      }
    }

    return {};
  }

  async deleteProductMedia(payload: { hostId: number, mediaId: number }): Promise<any> {
    const { hostId, mediaId } = payload;

    // Fetch the media details to get the publicId for deletion
    const mediaDetails = await productRepository.getProductMediaById({ hostId, mediaId });
    if (!mediaDetails || !mediaDetails.data) {
      throw createConfiguredError("MEDIA_NOT_FOUND", 'Product media not found.');
    }

    // Ensure the media has a publicId for deletion
    const publicId = mediaDetails.data.publicId;
    if (!publicId) {
      throw createConfiguredError("MEDIA_NOT_FOUND", 'Product media public ID not found.');
    }

    // Delete media from storage
    const deleteResult = await deleteMediaFromStorage(publicId);
    
    // Check if the deletion was successful
    if (!deleteResult || deleteResult.result !== 'ok') {
      throw createConfiguredError("DELETE_FAILED", 'Failed to delete media from storage.');
    }

    // Soft Delete media record from the database
    const deleteMediaInDB = await productRepository.updateProductMedia({
      updatePayload: {
        isDeleted: 1,
        updatedAt: DateTimeFormatUtil.getCurrentUnixTime()
      },
      where: {
        id: mediaId,
        hostId
      }
    });
    
    // Check if the database update was successful
    if (!deleteMediaInDB) {
      throw createConfiguredError("DELETE_FAILED", 'Failed to delete product media.');
    }
    return true;
  }
}

export default new ProductService();