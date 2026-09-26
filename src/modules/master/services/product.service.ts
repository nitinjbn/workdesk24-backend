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
  SaveProductMediaPayload,
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
    payload: {
      hostId: number;
      filter?: Record<string, unknown>;
      page?: number;
      limit?: number;
      sorting?: CommonReportSorting;
    },
    scope: ReportScope
  ): Promise<{ categories: any[]; pagination?: any }> {
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
    payload: {
      hostId: number;
      filter?: Record<string, unknown>;
      page?: number;
      limit?: number;
      sorting?: CommonReportSorting;
    },
    scope: ReportScope
  ): Promise<{ brands: any[]; pagination?: any }> {
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
    payload: {
      hostId: number;
      filter?: Record<string, unknown>;
      page?: number;
      limit?: number;
      sorting?: CommonReportSorting;
    },
    scope: ReportScope
  ): Promise<{ uom: any[]; pagination?: any }> {
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
    payload: { hostId: number; productId: number },
    scope: ReportScope
  ): Promise<ProductDetailsResponse<ProductInstance>> {
    let { hostId, productId } = payload;

    const productDetails = await productRepository.getProductById({
      hostId,
      productId,
    });
    if (
      !productDetails ||
      !Object(productDetails.data) ||
      Object.keys(productDetails.data).length === 0
    ) {
      throw createConfiguredError('PRODUCT_NOT_FOUND', 'Product not found.');
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      productDetails?.data && typeof productDetails.data.toJSON === 'function'
        ? productDetails.data.toJSON()
        : productDetails?.data;
    return {
      product: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  async getProductMedia(
    payload: { hostId: number; productId: number },
    scope: ReportScope
  ): Promise<ProductMediaResponse<ProductInstance>> {
    let { hostId, productId } = payload;

    const productMedia = await productRepository.getProductMedia({
      hostId,
      productId,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      productMedia?.data && typeof productMedia.data.toJSON === 'function'
        ? productMedia.data.toJSON()
        : productMedia?.data;
    return {
      media: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  async getProductAttributes(
    payload: { hostId: number; productId: number },
    scope: ReportScope
  ): Promise<ProductAttributesResponse<ProductInstance>> {
    let { hostId, productId } = payload;

    const productAttributes = await productRepository.getProductAttributes({
      hostId,
      productId,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData =
      productAttributes?.data && typeof productAttributes.data.toJSON === 'function'
        ? productAttributes.data.toJSON()
        : productAttributes?.data;
    return {
      attributes: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  private normalizeCommonSorting(payload: GetProductsPayload): {
    sortBy: string;
    sortOrder: 'ASC' | 'DESC';
  } {
    const requestedSortBy = payload.sort?.by || payload.sortBy;
    const requestedSortOrder = payload.sort?.order || payload.sortOrder;

    return {
      sortBy: requestedSortBy,
      sortOrder: requestedSortOrder as 'ASC' | 'DESC',
    };

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
    //console.log('############################# saveProductMedia payload:', payload);
    const {
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
    } = payload;
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
      createdAt: DateTimeFormatUtil.getCurrentUnixTime(),
    });

    return result;
  }

  private validateProduct(payload: any): void {
    const requiredFields = ['hostId', 'productName', 'sellingPrice', 'mrp'];
    for (const field of requiredFields) {
      if (!payload[field]) {
        throw createConfiguredError('VALIDATION_ERROR', `Missing required field: ${field}`);
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
      createdAt: currentUnixTime,
    });

    if (createProductResult?.id) {
      if (productMedia && Array.isArray(productMedia)) {
        //Now product is created, so we can save the media with the productId
        for (const media of productMedia) {
          await productRepository.updateProductMedia({
            updatePayload: {
              productId: createProductResult.id,
              isEnabled: media.isEnabled || 1, // Default to enabled if not provided
              updatedAt: currentUnixTime,
            },
            where: {
              id: media.mediaId,
              hostId: otherPayload.hostId,
            },
          });
        }
      }

      if (productAttribute && Array.isArray(productAttribute)) {
        // Now product is created, so we can save the attributes with the productId
        await productRepository.saveProductAttributes({
          hostId: otherPayload.hostId,
          productId: createProductResult.id,
          attributes: productAttribute,
          createdAt: currentUnixTime,
        });
      }
    }

    return createProductResult?.get({ plain: true }) || createProductResult;
  }

  async updateProduct(payload: any, scope: ReportScope): Promise<any> {
    const { productId, productMedia, productAttribute, ...otherPayload } = payload;
    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    // Validate required fields
    if (!productId) {
      throw createConfiguredError('VALIDATION_ERROR', 'Missing required field: productId');
    }

    // Validate other required fields for update
    this.validateProduct(payload);

    // Check if the product exists before updating
    const existingProduct = await productRepository.getProductById({
      hostId: otherPayload.hostId,
      productId: productId,
    });
    if (!existingProduct || !existingProduct.data) {
      throw createConfiguredError('PRODUCT_NOT_FOUND', 'Product not found.');
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
        isEnabled:
          otherPayload.isEnabled !== undefined
            ? otherPayload.isEnabled
            : existingProduct.data.isEnabled,
        updatedAt: currentUnixTime,
      },
      where: {
        id: productId,
        hostId: otherPayload.hostId,
      },
    });

    // Handle Product Media - Add, Update, Delete
    if (
      productMedia ||
      (existingProduct.data.productMedia && existingProduct.data.productMedia.length > 0)
    ) {
      const existingMediaIds =
        existingProduct.data.productMedia?.map((m: any) => Number(m.mediaId)) || [];
      const payloadMediaIds = productMedia?.map((m: any) => Number(m.mediaId)) || [];

      // Media to ADD (in payload but not in existing)
      const mediaToAdd =
        productMedia?.filter((m: any) => !existingMediaIds.includes(Number(m.mediaId))) || [];

      // Media to UPDATE (in both payload and existing)
      const mediaToUpdate =
        productMedia?.filter((m: any) => existingMediaIds.includes(Number(m.mediaId))) || [];

      // Media to DELETE (in existing but not in payload)
      const mediaToDelete =
        existingProduct.data.productMedia?.filter(
          (m: any) => !payloadMediaIds.includes(Number(m.mediaId))
        ) || [];

      // Execute ADD operations
      for (const media of mediaToAdd) {
        await productRepository.updateProductMedia({
          updatePayload: {
            productId: productId,
            isEnabled: media.isEnabled || 1, // Default to enabled if not provided
            isPrimary: media.isPrimary || 0,
            sortOrder: media.sortOrder || 0,
            updatedAt: currentUnixTime,
          },
          where: {
            id: media.mediaId,
            hostId: otherPayload.hostId,
          },
        });
      }

      // Execute UPDATE operations
      for (const media of mediaToUpdate) {
        await productRepository.updateProductMedia({
          updatePayload: {
            productId: productId,
            isEnabled: media.isEnabled || 1,
            isPrimary: media.isPrimary || 0,
            sortOrder: media.sortOrder || 0,
            updatedAt: currentUnixTime,
          },
          where: {
            id: media.mediaId,
            hostId: otherPayload.hostId,
          },
        });
      }

      // Execute DELETE operations (soft delete)
      if (mediaToDelete.length > 0) {
        await productRepository.updateProductMedia({
          updatePayload: {
            isDeleted: 1,
            updatedAt: currentUnixTime,
          },
          where: {
            id: mediaToDelete.map((m) => Number(m.mediaId)),
            hostId: otherPayload.hostId,
          },
        });
      }
    }

    // Handle Product Attributes - Add, Update, Delete
    if (
      productAttribute ||
      (existingProduct.data.productAttribute && existingProduct.data.productAttribute.length > 0)
    ) {
      const existingAttributeIds =
        existingProduct.data.productAttribute?.map((a: any) => a.id) || [];
      const payloadAttributeIds = productAttribute?.map((a: any) => a.attributeId || a.id) || [];

      // Attributes to ADD (in payload but not in existing)
      const attributesToAdd =
        productAttribute?.filter(
          (a: any) => !existingAttributeIds.includes(a.attributeId || a.id)
        ) || [];
      if (attributesToAdd.length > 0) {
        await productRepository.saveProductAttributes({
          hostId: otherPayload.hostId,
          productId: productId,
          attributes: attributesToAdd,
          createdAt: currentUnixTime,
        });
      }

      // Attributes to UPDATE (in both payload and existing)
      const attributesToUpdate =
        productAttribute?.filter((a: any) =>
          existingAttributeIds.includes(a.attributeId || a.id)
        ) || [];
      for (const attr of attributesToUpdate) {
        await productRepository.updateProductAttributes({
          updatePayload: {
            attributeGroup: attr.attributeGroup,
            attributeName: attr.attributeName,
            attributeValue: attr.attributeValue,
            attributeType: attr.attributeType,
            attributeUomId: attr.attributeUomId,
            isEnabled: attr.isEnabled !== undefined ? attr.isEnabled : 1,
            updatedAt: currentUnixTime,
          },
          where: {
            id: attr.attributeId || attr.id,
            hostId: otherPayload.hostId,
          },
        });
      }

      // Attributes to DELETE (in existing but not in payload)
      const attributesToDelete =
        existingProduct.data.productAttribute?.filter(
          (a: any) => !payloadAttributeIds.includes(a.id)
        ) || [];

      if (attributesToDelete.length > 0) {
        await productRepository.updateProductAttributes({
          updatePayload: {
            isDeleted: 1,
            deletedAt: currentUnixTime,
          },
          where: {
            id: attributesToDelete.map((a) => a.attributeId || a.id),
            hostId: otherPayload.hostId,
          },
        });
      }
    }

    return {};
  }

  async deleteProductMedia(payload: { hostId: number; mediaId: number }): Promise<any> {
    const { hostId, mediaId } = payload;

    // Fetch the media details to get the publicId for deletion
    const mediaDetails = await productRepository.getProductMediaById({ hostId, mediaId });
    if (!mediaDetails || !mediaDetails.data) {
      throw createConfiguredError('MEDIA_NOT_FOUND', 'Product media not found.');
    }

    // Ensure the media has a publicId for deletion
    const publicId = mediaDetails.data.publicId;
    if (!publicId) {
      throw createConfiguredError('MEDIA_NOT_FOUND', 'Product media public ID not found.');
    }

    // Delete media from storage
    const deleteResult = await deleteMediaFromStorage(publicId);

    // Check if the deletion was successful
    if (!deleteResult || deleteResult.result !== 'ok') {
      throw createConfiguredError('DELETE_FAILED', 'Failed to delete media from storage.');
    }

    // Soft Delete media record from the database
    const deleteMediaInDB = await productRepository.updateProductMedia({
      updatePayload: {
        url: null,
        publicId: null,
        isEnabled: 0,
        isDeleted: 1,
        updatedAt: DateTimeFormatUtil.getCurrentUnixTime(),
      },
      where: {
        id: mediaId,
        hostId,
      },
    });

    // Check if the database update was successful
    if (!deleteMediaInDB) {
      throw createConfiguredError('DELETE_FAILED', 'Failed to delete product media.');
    }
    return true;
  }

  async deleteProduct(payload: { hostId: number; productId: number }): Promise<any> {
    const { hostId, productId } = payload;
    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    // Check if the product exists before deleting
    const existingProduct = await productRepository.getProductById({
      hostId,
      productId,
    });
    if (!existingProduct || !existingProduct.data) {
      throw createConfiguredError('PRODUCT_NOT_FOUND', 'Product not found.');
    }
    // Soft delete the product
    const deleteResult = await productRepository.updateProduct({
      updatePayload: {
        isDeleted: 1,
        updatedAt: currentUnixTime,
      },
      where: {
        id: productId,
        hostId,
      },
    });
    if (!deleteResult) {
      throw createConfiguredError('DELETE_FAILED', 'Failed to delete product.');
    }

    // Soft delete associated media
    if (existingProduct.data.productMedia && existingProduct.data.productMedia.length > 0) {
      for (const media of existingProduct.data.productMedia) {
        await this.deleteProductMedia({
          hostId,
          mediaId: media.mediaId,
        });
      }
    }

    // Soft delete associated attributes
    if (existingProduct.data.productAttribute && existingProduct.data.productAttribute.length > 0) {
      const attributeIds = existingProduct.data.productAttribute.map(
        (a: any) => a.attributeId || a.id
      );
      await productRepository.updateProductAttributes({
        updatePayload: {
          isDeleted: 1,
          updatedAt: currentUnixTime,
        },
        where: {
          id: attributeIds,
          hostId,
        },
      });
    }

    return true;
  }

  async createCategory(payload: { hostId: number; categoryName: string }): Promise<any> {
    const { hostId, categoryName } = payload;

    // Check if the category already exists
    const existingCategory = await productRepository.getCategories({
      hostId,
      filter: {
        categoryName,
      },
    });
    if (existingCategory?.data?.length > 0) {
      throw createConfiguredError('CATEGORY_ALREADY_EXISTS', 'Category already exists.');
    }

    const createResult = await productRepository.createCategory({
      hostId,
      categoryName,
      createdAt: DateTimeFormatUtil.getCurrentUnixTime(),
    });
    if (!createResult) {
      throw createConfiguredError('CREATE_FAILED', 'Failed to create category.');
    }
    return createResult;
  }

  async updateCategory(payload: {
    hostId: number;
    categoryId: number;
    categoryName: string;
  }): Promise<any> {
    const { hostId, categoryId, categoryName } = payload;

    // Check if the category already exists
    const existingCategory = await productRepository.getCategories({
      hostId,
      filter: {
        categoryName,
        ignoreId: categoryId,
      },
    });
    if (existingCategory?.data?.length > 0) {
      throw createConfiguredError('CATEGORY_ALREADY_EXISTS', 'Category already exists.');
    }

    const updateResult = await productRepository.updateCategory({
      hostId,
      categoryId,
      categoryName,
      updatedAt: DateTimeFormatUtil.getCurrentUnixTime(),
    });
    if (!updateResult) {
      throw createConfiguredError('UPDATE_FAILED', 'Failed to update category.');
    }
    return updateResult;
  }

  async deleteCategory(payload: { hostId: number; categoryId: number }): Promise<any> {
    const { hostId, categoryId } = payload;
    const deleteResult = await productRepository.deleteCategory({
      hostId,
      categoryId,
      deletedAt: DateTimeFormatUtil.getCurrentUnixTime(),
    });
    if (!deleteResult) {
      throw createConfiguredError('DELETE_FAILED', 'Failed to delete category.');
    }
    return deleteResult;
  }

  async createBrand(payload: { hostId: number; brandName: string }): Promise<any> {
    const { hostId, brandName } = payload;

    // Check if the brand already exists
    const existingBrand = await productRepository.getBrands({
      hostId,
      filter: {
        brandName,
      },
    });
    if (existingBrand?.data?.length > 0) {
      throw createConfiguredError('BRAND_ALREADY_EXISTS', 'Brand already exists.');
    }

    const createResult = await productRepository.createBrand({
      hostId,
      brandName,
      createdAt: DateTimeFormatUtil.getCurrentUnixTime(),
    });
    if (!createResult) {
      throw createConfiguredError('CREATE_FAILED', 'Failed to create brand.');
    }
    return createResult;
  }

  async updateBrand(payload: { hostId: number; brandId: number; brandName: string }): Promise<any> {
    const { hostId, brandId, brandName } = payload;

    // Check if the brand already exists
    const existingBrand = await productRepository.getBrands({
      hostId,
      filter: {
        brandName,
        ignoreId: brandId,
      },
    });
    if (existingBrand?.data?.length > 0) {
      throw createConfiguredError('BRAND_ALREADY_EXISTS', 'Brand already exists.');
    }

    const updateResult = await productRepository.updateBrand({
      hostId,
      brandId,
      brandName,
      updatedAt: DateTimeFormatUtil.getCurrentUnixTime(),
    });
    if (!updateResult) {
      throw createConfiguredError('UPDATE_FAILED', 'Failed to update brand.');
    }
    return updateResult;
  }

  async deleteBrand(payload: { hostId: number; brandId: number }): Promise<any> {
    const { hostId, brandId } = payload;
    const deleteResult = await productRepository.deleteBrand({
      hostId,
      brandId,
      deletedAt: DateTimeFormatUtil.getCurrentUnixTime(),
    });
    if (!deleteResult) {
      throw createConfiguredError('DELETE_FAILED', 'Failed to delete brand.');
    }
    return deleteResult;
  }
}

export default new ProductService();
