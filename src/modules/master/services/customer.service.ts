import customerRepository from '../repositories/customer.repository';
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
  SaveCustomerMediaPayload
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

export class CustomerService {
  async getCustomerTypes(
    payload: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sorting?: CommonReportSorting },
    scope: ReportScope
  ): Promise<{ customerTypes: any[], pagination?: any }> {
    
    const { hostId, filter, page, limit } = payload;
    const sorting = this.normalizeCommonSorting(payload);

    const report = await customerRepository.getCustomerTypes({
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
      customerTypes: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getCustomers(
    payload: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sorting?: CommonReportSorting },
    scope: ReportScope
  ): Promise<{ customers: any[], pagination?: any }> {
    
    const { hostId, filter, page, limit } = payload;
    const sorting = this.normalizeCommonSorting(payload);

    const report = await customerRepository.getCustomers({
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
      customers: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getCustomerDetails(
    payload: { hostId: number, customerId: number },
    scope: ReportScope
  ): Promise<any> {
    let { hostId, customerId } = payload;

    const customerDetails = await customerRepository.getCustomerById({
      hostId,
      customerId
    });    
    if (!customerDetails || !Object(customerDetails.data) || Object.keys(customerDetails.data).length === 0) {
      throw createConfiguredError("CUSTOMER_NOT_FOUND", 'Customer not found.');
    }

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const plainData = customerDetails?.data && typeof customerDetails.data.toJSON === 'function' 
      ? customerDetails.data.toJSON() 
      : customerDetails?.data;
    return {
      customer: formatDateTimeFieldsBySettings(plainData as any, dateTimeSettings),
    };
  }

  /*
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
  */

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

  
  async saveCustomerMedia(payload: SaveCustomerMediaPayload): Promise<any> {
    //console.log('############################# saveCustomerMedia payload:', payload);
    const { hostId, customerId, mediaUrl, mediaType, publicId, fileName, fileSizeInBytes, mimeType, isPrimary, sortOrder, isEnabled  } = payload;
      const result = await customerRepository.saveCustomerMedia({
        hostId,
        customerId,
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

  private validateCustomer(payload: any): void {
    const requiredFields = ['hostId', 'customerName'];
    for (const field of requiredFields) {
      if (!payload[field]) {
        throw createConfiguredError("VALIDATION_ERROR", `Missing required field: ${field}`);
      }
    }
  }

  async createCustomer(payload: any): Promise<any> {
    const { customerMedia, customerAttribute, ...otherPayload } = payload;
    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    // Validate required fields
    this.validateCustomer(payload);

    const createCustomerResult = await customerRepository.createCustomer({
      hostId: otherPayload.hostId,
      customerCode: otherPayload.customerCode,
      customerName: otherPayload.customerName,
      customerTypeId: otherPayload.customerTypeId,
      contactPerson: otherPayload.contactPerson,
      email: otherPayload.email,
      mobile: otherPayload.mobile,
      alternateMobile: otherPayload.alternateMobile,
      gstNumber: otherPayload.gstNumber,
      panNumber: otherPayload.panNumber,
      addressLine1: otherPayload.addressLine1,
      addressLine2: otherPayload.addressLine2,
      city: otherPayload.city,
      stateName: otherPayload.stateName,
      stateIsoCode: otherPayload.stateIsoCode,
      postalCode: otherPayload.postalCode,
      countryName: otherPayload.countryName,
      countryIsoCode: otherPayload.countryIsoCode,
      remarks: otherPayload.remarks,
      isEnabled: otherPayload.isEnabled !== undefined ? otherPayload.isEnabled : 1, // Default to enabled if not provided
      createdAt: currentUnixTime
    });

    if (createCustomerResult?.id) {
      if (customerMedia && Array.isArray(customerMedia)) {
        //Now customer is created, so we can save the media with the customerId
        for (const media of customerMedia) {
          await customerRepository.updateCustomerMedia({
            updatePayload: {
              customerId: createCustomerResult.id,
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

      if (customerAttribute && Array.isArray(customerAttribute)) {
        // Now customer is created, so we can save the attributes with the customerId
        await customerRepository.saveCustomerAttributes({
          hostId: otherPayload.hostId,
          customerId: createCustomerResult.id,
          attributes: customerAttribute,
          createdAt: currentUnixTime
        });
      }
    }

    return createCustomerResult?.get({ plain: true }) || createCustomerResult;
  }

  
  async updateCustomer(payload: any): Promise<any> {
    const { customerId, customerMedia, customerAttribute, ...otherPayload } = payload;
    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    // Validate required fields
    if (!customerId) {
      throw createConfiguredError("VALIDATION_ERROR", 'Missing required field: customerId');
    }

    // Validate other required fields for update
    this.validateCustomer(payload);

    // Check if the customer exists before updating
    const existingCustomer = await customerRepository.getCustomerById({
      hostId: otherPayload.hostId,
      customerId: customerId
    });
    //console.log('############################# existingCustomer:', existingCustomer);
    if (!existingCustomer || !existingCustomer.data) {
      throw createConfiguredError("CUSTOMER_NOT_FOUND", 'Customer not found.');
    }

    const updateCustomerResult = await customerRepository.updateCustomer({
      updatePayload: {
        customerCode: otherPayload.customerCode,
        customerName: otherPayload.customerName,
        customerTypeId: otherPayload.customerTypeId,
        contactPerson: otherPayload.contactPerson,
        email: otherPayload.email,
        mobile: otherPayload.mobile,
        alternateMobile: otherPayload.alternateMobile,
        gstNumber: otherPayload.gstNumber,
        panNumber: otherPayload.panNumber,
        addressLine1: otherPayload.addressLine1,
        addressLine2: otherPayload.addressLine2,
        city: otherPayload.city,
        stateName: otherPayload.stateName,
        stateIsoCode: otherPayload.stateIsoCode,
        postalCode: otherPayload.postalCode,
        countryName: otherPayload.countryName,
        countryIsoCode: otherPayload.countryIsoCode,
        remarks: otherPayload.remarks,
        isEnabled: otherPayload.isEnabled !== undefined ? otherPayload.isEnabled : 1, // Default to enabled if not provided
        updatedAt: currentUnixTime
      },
      where: {
        id: customerId,
        hostId: otherPayload.hostId
      }
    });

    // Handle Product Media - Add, Update, Delete
    if (customerMedia || (existingCustomer.data.customerMedia && existingCustomer.data.customerMedia.length > 0)) {
      const existingMediaIds = existingCustomer.data.customerMedia?.map((m: any) => Number(m.mediaId)) || [];
      const payloadMediaIds = customerMedia?.map((m: any) => Number(m.mediaId)) || [];
      //console.log('############################# existingMediaIds:', existingMediaIds);
      //console.log('############################# payloadMediaIds:', payloadMediaIds);

      // Media to ADD (in payload but not in existing)
      const mediaToAdd = customerMedia?.filter((m: any) => !existingMediaIds.includes(Number(m.mediaId))) || [];
      
      // Media to UPDATE (in both payload and existing)
      const mediaToUpdate = customerMedia?.filter((m: any) => existingMediaIds.includes(Number(m.mediaId))) || [];
            
      // Media to DELETE (in existing but not in payload)
      const mediaToDelete = existingCustomer.data.customerMedia?.filter((m: any) => !payloadMediaIds.includes(Number(m.mediaId))) || [];
      
      //console.log('############################# mediaToAdd:', mediaToAdd);
      //console.log('############################# mediaToUpdate:', mediaToUpdate);
      //console.log('############################# mediaToDelete:', mediaToDelete);

      // Execute ADD operations
      for (const media of mediaToAdd) {
        await customerRepository.updateCustomerMedia({
          updatePayload: {
            customerId: customerId,
            isEnabled: media.isEnabled || 1, // Default to enabled if not provided
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

      // Execute UPDATE operations
      for (const media of mediaToUpdate) {
        await customerRepository.updateCustomerMedia({
          updatePayload: {
            customerId: customerId,
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
        await customerRepository.updateCustomerMedia({
          updatePayload: {
            isDeleted: 1,
            updatedAt: currentUnixTime
          },
          where: {
            id: mediaToDelete.map(m => Number(m.mediaId)),
            customerId: customerId,
            hostId: otherPayload.hostId
          }
        });
      }
    }

    // Handle Product Attributes - Add, Update, Delete
    if (customerAttribute || (existingCustomer.data.customerAttribute && existingCustomer.data.customerAttribute.length > 0)) {
      const existingAttributeIds = existingCustomer.data.customerAttribute?.map((a: any) => a.id) || [];
      const payloadAttributeIds = customerAttribute?.map((a: any) => a.attributeId || a.id) || [];

      // Attributes to ADD (in payload but not in existing)
      const attributesToAdd = customerAttribute?.filter((a: any) => !existingAttributeIds.includes(a.attributeId || a.id)) || [];
      if (attributesToAdd.length > 0) {
        await customerRepository.saveCustomerAttributes({
          hostId: otherPayload.hostId,
          customerId: customerId,
          attributes: attributesToAdd,
          createdAt: currentUnixTime
        });
      }

      // Attributes to UPDATE (in both payload and existing)
      const attributesToUpdate = customerAttribute?.filter((a: any) => existingAttributeIds.includes(a.attributeId || a.id)) || [];
      for (const attr of attributesToUpdate) {
        await customerRepository.updateCustomerAttributes({
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
      const attributesToDelete = existingCustomer.data.customerAttribute?.filter((a: any) => !payloadAttributeIds.includes(a.id)) || [];

      if(attributesToDelete.length > 0) {
        await customerRepository.updateCustomerAttributes({
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

  async deleteCustomerMedia(payload: { hostId: number, mediaId: number }): Promise<any> {
    const { hostId, mediaId } = payload;

    // Fetch the media details to get the publicId for deletion
    const mediaDetails = await customerRepository.getCustomerMediaById({ hostId, mediaId });
    if (!mediaDetails || !mediaDetails.data) {
      throw createConfiguredError("MEDIA_NOT_FOUND", 'Customer media not found.');
    }

    // Ensure the media has a publicId for deletion
    const publicId = mediaDetails.data.publicId;
    if (!publicId) {
      throw createConfiguredError("MEDIA_NOT_FOUND", 'Customer media public ID not found.');
    }

    // Delete media from storage
    const deleteResult = await deleteMediaFromStorage(publicId);
    
    // Check if the deletion was successful
    if (!deleteResult || deleteResult.result !== 'ok') {
      throw createConfiguredError("DELETE_FAILED", 'Failed to delete media from storage.');
    }

    // Soft Delete media record from the database
    const deleteMediaInDB = await customerRepository.updateCustomerMedia({
      updatePayload: {
        url: null,
        publicId: null,
        isEnabled: 0,
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
      throw createConfiguredError("DELETE_FAILED", 'Failed to delete customer media.');
    }
    return true;
  }

  async deleteCustomer(payload: { hostId: number, customerId: number }): Promise<any> {
    const { hostId, customerId } = payload;
    const currentUnixTime = DateTimeFormatUtil.getCurrentUnixTime();

    // Check if the product exists before deleting
    const existingProduct = await customerRepository.getCustomerById({
      hostId,
      customerId
    });
    if (!existingProduct || !existingProduct.data) {
      throw createConfiguredError("CUSTOMER_NOT_FOUND", 'Customer not found.');
    }
    // Soft delete the product
    const deleteResult = await customerRepository.updateCustomer({
      updatePayload: {
        isDeleted: 1,
        updatedAt: currentUnixTime
      },
      where: {
        id: customerId,
        hostId
      }
    });
    if (!deleteResult) {
      throw createConfiguredError("DELETE_FAILED", 'Failed to delete customer.');
    }

    // Soft delete associated media
    if (existingProduct.data.customerMedia && existingProduct.data.customerMedia.length > 0) {
      for (const media of existingProduct.data.customerMedia) {
        await this.deleteCustomerMedia({
          hostId,
          mediaId: media.mediaId
        });
      }
    }

    // Soft delete associated attributes
    if (existingProduct.data.customerAttribute && existingProduct.data.customerAttribute.length > 0) {
      const attributeIds = existingProduct.data.customerAttribute.map((a: any) => a.attributeId || a.id);
      await customerRepository.updateCustomerAttributes({
        updatePayload: {
          isDeleted: 1,
          updatedAt: currentUnixTime
        },
        where: {
          id: attributeIds,
          hostId
        }
      });
    }

    return true;
  }
}

export default new CustomerService();