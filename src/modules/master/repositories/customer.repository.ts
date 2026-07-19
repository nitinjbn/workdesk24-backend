import { FindAndCountOptions, Op} from 'sequelize';
import db, { Product, ProductAttribute, ProductBrand, ProductMedia, ProductCategory, UOM, CustomerType, Customer, CustomerMedia, CustomerAttribute } from '../../../models';
import { GetCustomersPayload, GetProductDetailsByIdPayload, ReportResponse, SingleRecordResponse, ProductMediaResponse, GetProductMediaDetailsByIdPayload, GetProductAttributesDetailsByIdPayload, SaveProductMediaPayload, SaveProductAttributesPayload, SaveCustomerMediaPayload, SaveCustomerAttributesPayload} from '../types/master.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder } from './user-scoped-report.helper';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

//type ProductInstance = typeof Product.prototype;

export class customerRepository {
  async getCustomerTypes(params: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sortBy?: string, sortOrder?: 'ASC' | 'DESC' }): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    // const order = buildCommonReportOrder(sortBy as any, sortOrder, {
    //   createdAt: 'createdAt'
    // });
    let order=[];
    if(sortBy && sortOrder) {
      order = [[sortBy, sortOrder]]
    }
    
    const where:any = {
      hostId,
      isDeleted:0
    }
    if(filter) {
      if(filter.id || filter.categoryId) {
        where.id = filter.categoryId || filter.id;
      }
      if(filter.customerTypeName) {
        where.customerTypeName = {
          [Op.like]: `%${(filter.customerTypeName as string).trim()}%`,
        }
      }
    }
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'hostId', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('CustomerType.id'), 'customerTypeId']
        ]
      },
      where,
      order,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await CustomerType.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
    } else {
      const rows = await CustomerType.findAll(query);
      return {
        data: rows
      };
    }
  }

  async getCustomers(params: GetCustomersPayload): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    let order: any = [
      ['updatedAt', 'DESC'],
      ['createdAt', 'DESC']
    ];

    if(sortBy && sortOrder) {
      order = [[sortBy, sortOrder]]
    }
    const where:any = {
      hostId,
      isDeleted:0
    }
    if(filter) {
      if (filter.searchKey?.trim()) {
        const searchKey = filter.searchKey.trim();
        where[Op.or] = [
          {
            customerName: {
              [Op.like]: `%${searchKey}%`,
            },
          },
          {
            customerCode: {
              [Op.like]: `%${searchKey}%`,
            },
          },
          {
            contactPerson: {
              [Op.like]: `%${searchKey}%`,
            },
          },
          {
            email: {
              [Op.like]: `%${searchKey}%`,
            },
          },
          {
            mobile: {
              [Op.like]: `%${searchKey}%`,
            },
          }
        ];
      }

      if(filter.id || filter.customerId) {
        where.id = filter.customerId || filter.id;
      }
      if(filter.customerName) {
        where.customerName = {
          [Op.like]: `%${(filter.customerName as string).trim()}%`,
        }
      }
      if(filter.customerCode) {
        where.customerCode = filter.customerCode;
      }
      if(filter.customerTypeId) {
        where.customerTypeId = filter.customerTypeId;
      }
    }
    const query: FindAndCountOptions<any> = {
      attributes: {
        include: [
          [db.Sequelize.col('Customer.id'), 'customerId'],
          [db.Sequelize.col('customerTypeDetails.customerTypeName'), 'customerTypeName']
        ],
        exclude: ['id', 'hostId', 'isDeleted', 'deletedAt']
      },
      where,
      include:[
        {
          attributes: [],
          model: CustomerType,
          where: {
            isDeleted: 0
          },
          as: "customerTypeDetails",
          required: true
        },
        {
          attributes: {
            include: [["id", "mediaId"]],
            exclude: ['id', 'hostId', 'customerId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: CustomerMedia,
          where: {
            isDeleted: 0,
            isEnabled: 1
          },
          as: "customerMedia",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        },
        {
          attributes: {
            exclude: ['hostId', 'customerId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: CustomerAttribute,
          where: {
            isDeleted: 0
          },
          as: "customerAttribute",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        }
      ],
      order,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await Customer.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
    } else {
      const rows = await Customer.findAll(query);
      return {
        data: rows
      };
    }
  }

  async getCustomerById(params: { hostId: number, customerId: number }): Promise<any> {
    const { hostId, customerId } = params;

    const where:any = {
      id: customerId,
      hostId,
      isDeleted:0
    }
   
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
        include: [
          [db.Sequelize.col('Customer.id'), 'customerId'],
          [db.Sequelize.col('customerTypeDetails.customerTypeName'), 'customerTypeName']
        ]
      },
      where,
      include:[
        {
          attributes:[],
          model: CustomerType,
          where: {
            isDeleted: 0
          },
          as: "customerTypeDetails",
          required: false
        },
        {
          attributes: {
            include: [["id", "mediaId"]],
            exclude: ['id', 'hostId', 'customerId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: CustomerMedia,
          where: {
            isDeleted: 0,
            isEnabled: 1
          },
          as: "customerMedia",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        },
        {
          attributes: {
            exclude: ['hostId', 'customerId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: CustomerAttribute,
          where: {
            isDeleted: 0
          },
          as: "customerAttribute",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        }
      ],
      logging: console.log, // Enable logging for debugging
    };

    const customerDetails = await Customer.findOne(query);
    return {
      data: customerDetails?.toJSON() || {}
    };
  }

  /*
  async getBrands(params: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sortBy?: string, sortOrder?: 'ASC' | 'DESC' }): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    // const order = buildCommonReportOrder(sortBy as any, sortOrder, {
    //   createdAt: 'createdAt'
    // });
    let order=[];
    if(sortBy && sortOrder) {
      order = [[sortBy, sortOrder]]
    }

    const where:any = {
      hostId,
      isDeleted:0
    }
    if(filter) {
      if(filter.id || filter.brandId) {
        where.id = filter.brandId || filter.id;
      }
      if(filter.brandName) {
        where.brandName = {
          [Op.like]: `%${(filter.brandName as string).trim()}%`,
        }
      }
    }
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'hostId', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('ProductBrand.id'), 'brandId']
        ]
      },
      where,
      order,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await ProductBrand.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
    } else {
      const rows = await ProductBrand.findAll(query);
      return {
        data: rows
      };
    }
  }

  async getUOM(params: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sortBy?: string, sortOrder?: 'ASC' | 'DESC' }): Promise<ReportResponse<any>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    // const order = buildCommonReportOrder(sortBy as any, sortOrder, {
    //   createdAt: 'createdAt'
    // });
    let order=[];
    if(sortBy && sortOrder) {
      order = [[sortBy, sortOrder]]
    }

    const where:any = {
      hostId: {
        [Op.or]: [
          { [Op.in]: [hostId, 0] },
          { [Op.is]: null }
        ] // Include UOMs with hostId 0 (global), specific hostId, and NULL hostId
      },
      isDeleted:0
    }
    if(filter?.isEnabled !== undefined) {
      where.isEnabled = filter.isEnabled;
    } else {
      where.isEnabled = 1; // Default to only enabled UOMs if not specified
    }
    
    if(filter) {
      if(filter.id || filter.uomId) {
        where.id = filter.uomId || filter.id;
      }
      if(filter.uomCode) {
        where.uomCode = filter.uomCode;
      }
      if(filter.uomName) {
        where.uomName = {
          [Op.like]: `%${(filter.uomName as string).trim()}%`,
        }
      }
    }
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['id', 'hostId', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('UOM.id'), 'uomId']
        ]
      },
      where,
      order,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await UOM.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
    } else {
      const rows = await UOM.findAll(query);
      return {
        data: rows
      };
    }
  }

  async getProducts(params: GetProductsPayload): Promise<ReportResponse<ProductInstance>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    // const order = buildCommonReportOrder(sortBy, sortOrder, {
    //   createdAt: 'createdAt'
    // });

    let order=[["createdAt", "DESC"],["updatedAt", "DESC"]];
    if(sortBy && sortOrder) {
      order = [[sortBy, sortOrder]];
    }

    const where:any = {
      hostId,
      isDeleted:0
    }

    if(filter) {
      if (filter.searchKey?.trim()) {
        const searchKey = filter.searchKey.trim();
        where[Op.or] = [
          {
            productName: {
              [Op.like]: `%${searchKey}%`,
            },
          },
          {
            productCode: {
              [Op.like]: `%${searchKey}%`,
            },
          },
          {
            shortName: {
              [Op.like]: `%${searchKey}%`,
            },
          },
        ];
      }
      
      if(filter.productId || filter.id) {
        filter.id = filter.productId || filter.id;
      }
      if(filter.productName) {
        where.productName = {
          [Op.like]: `%${filter.productName.trim()}%`,
        }
      }
      if(filter.productCode) {
        where.productCode = filter.productCode;
      }
      if(filter.sku) {
        where.sku = filter.sku;
      }
      if(filter.barCode) {
        where.barCode = filter.barCode;
      }
      if(filter.hsnCode) {
        where.hsnCode = filter.hsnCode;
      }
      if(filter.categoryId) {
        where.categoryId = filter.categoryId;
      }
      if(filter.brandId) {
        where.brandId = filter.brandId;
      }
    }
   
    const query: FindAndCountOptions<ProductInstance> = {
      attributes: {
        exclude: ['id', 'isEnabled', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('Product.id'), 'productId'],
          [db.Sequelize.col('productCategoryDetails.categoryName'), 'category'],
          [db.Sequelize.col('productBrandDetails.brandName'), 'brand'],
          [db.Sequelize.col('productUOMDetails.uomName'), 'uom']
        ]
      },
      where,
      include:[
        {
          attributes:[],
          model: ProductCategory,
          where: {
            isDeleted: 0
          },
          as: "productCategoryDetails",
          required: false
        },
        {
          attributes:[],
          model: ProductBrand,
          where: {
            isDeleted: 0
          },
          as: "productBrandDetails",
          required: false
        },
        {
          attributes:[],
          model: UOM,
          where: {
            isDeleted: 0
          },
          as: "productUOMDetails",
          required: false
        },
        {
          attributes: {
            include: [["id", "mediaId"]],
            exclude: ['id', 'hostId', 'productId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: ProductMedia,
          where: {
            isDeleted: 0,
            isEnabled: 1
          },
          as: "productMedia",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        },
        {
          attributes: {
            exclude: ['hostId', 'productId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: ProductAttribute,
          where: {
            isDeleted: 0
          },
          as: "productAttribute",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        }
      ],
      order: order as any,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await Product.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };

    } else {
      const rows = await Product.findAll(query);
      return {
        data: rows
      };
    }
  }

  async getProductById(params: GetProductDetailsByIdPayload): Promise<any> {
    const { hostId, productId } = params;

    const where:any = {
      id: productId,
      hostId,
      isDeleted:0
    }
   
    const query: FindAndCountOptions<ProductInstance> = {
      attributes: {
        exclude: ['id', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
        include: [
          [db.Sequelize.col('Product.id'), 'productId'],
          [db.Sequelize.col('productCategoryDetails.categoryName'), 'category'],
          [db.Sequelize.col('productBrandDetails.brandName'), 'brand']
        ]
      },
      where,
      include:[
        {
          attributes:[],
          model: ProductCategory,
          where: {
            isDeleted: 0
          },
          as: "productCategoryDetails",
          required: false
        },
        {
          attributes:[],
          model: ProductBrand,
          where: {
            isDeleted: 0
          },
          as: "productBrandDetails",
          required: false
        },
        {
          attributes: {
            include: [["id", "mediaId"]],
            exclude: ['id', 'hostId', 'productId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: ProductMedia,
          where: {
            isDeleted: 0,
            isEnabled: 1
          },
          as: "productMedia",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        },
        {
          attributes: {
            exclude: ['hostId', 'productId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
          },
          model: ProductAttribute,
          where: {
            isDeleted: 0
          },
          as: "productAttribute",
          separate: true,
          order: [["sortOrder", "ASC"]],
          required: false
        }
      ],
      logging: console.log, // Enable logging for debugging
    };

    const productDetails = await Product.findOne(query);
    return {
      data: productDetails?.toJSON() || {}
    };
  }

  async getProductMedia(params: GetProductMediaDetailsByIdPayload): Promise<any> {
    const { hostId, productId, filter } = params;

    const where:any = {
      productId: productId,
      hostId,
      isDeleted:0
    }
    if(filter) {
      if(filter.mediaId || filter.id) {
        where.id = filter.mediaId || filter.id;
      }
      if(filter.mediaType) {
        where.mediaType = filter.mediaType;
      }
      if(filter.isEnabled !== undefined) {
        where.isEnabled = filter.isEnabled;
      }
    }
   
    const query: FindAndCountOptions<any> = {      
      attributes: {
        exclude: ['hostId', 'productId', 'isDeleted', 'deletedAt'],
      },         
      where,
      order: [["sortOrder", "ASC"]],
      raw: true,
      logging: console.log, // Enable logging for debugging
    };

    const mediaDetails = await ProductMedia.findAll(query);
    return {
      data: mediaDetails
    };
  }

  async getProductAttributes(params: GetProductAttributesDetailsByIdPayload): Promise<any> {
    const { hostId, productId, filter } = params;

    const where:any = {
      productId: productId,
      hostId,
      isDeleted:0
    }
    if(filter) {
      if(filter.attributeId || filter.id) {
        where.id = filter.attributeId || filter.id;
      }
      if(filter.attributeType) {
        where.attributeType = filter.attributeType;
      }
      if(filter.isEnabled !== undefined) {
        where.isEnabled = filter.isEnabled;
      }
    }
   
    const query: FindAndCountOptions<any> = {      
      attributes: {
        exclude: ['hostId', 'productId', 'isDeleted', 'deletedAt'],
      },         
      where,
      order: [["sortOrder", "ASC"]],
      raw: true,
      logging: console.log, // Enable logging for debugging
    };

    const attributeDetails = await ProductAttribute.findAll(query);
    return {
      data: attributeDetails
    };
  }
  */

  async saveCustomerMedia(params: SaveCustomerMediaPayload): Promise<any> {
    const { hostId, customerId, mediaUrl, mediaType, publicId, fileName, fileSizeInBytes, mimeType, isPrimary, sortOrder, isEnabled, createdAt } = params;
    const newMedia = await CustomerMedia.create({
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
      createdAt
    });

    return newMedia;
  }

  
  async updateCustomerMedia(params: any): Promise<any> {
    const { updatePayload, where } = params;
    const updateResult = await CustomerMedia.update(updatePayload, {
      where
    });

    return updateResult;
  }

  
  async saveCustomerAttributes(params: SaveCustomerAttributesPayload): Promise<any[]> {
    const { hostId, customerId, attributes, createdAt } = params;

    if (!attributes?.length) {
      return [];
    }

    const rows = attributes.map((attribute) => ({
      hostId,
      customerId,
      attributeGroup: attribute.attributeGroup || null,
      attributeName: attribute.attributeName,
      attributeValue: attribute.attributeValue,
      attributeType: attribute.attributeType || null,
      attributeUomId: attribute.attributeUomId,
      sortOrder: attribute.sortOrder || 0,
      isEnabled: attribute.isEnabled || 1,
      createdAt,
    }));

    return CustomerAttribute.bulkCreate(rows);
  }
  

  async createCustomer(params: any): Promise<any> {
    const { hostId, customerCode, customerName, customerTypeId, contactPerson, email, mobile, alternateMobile, gstNumber, panNumber, addressLine1, addressLine2, city, stateName, stateIsoCode, postalCode, countryName, countryIsoCode, remarks, isEnabled } = params;
    const newCustomer = await Customer.create({
      hostId,
      customerCode,
      customerName,
      customerTypeId,
      contactPerson,
      email,
      mobile,
      alternateMobile,
      gstNumber,
      panNumber,
      addressLine1,
      addressLine2,
      city,
      stateName,
      stateIsoCode,
      postalCode,
      countryName,
      countryIsoCode,
      remarks,
      isEnabled,
      createdAt: DateTimeFormatUtil.getCurrentUnixTime()
    });

    return newCustomer;
  }
  
  
  async getCustomerMediaById(params: { hostId: number, mediaId: number }): Promise<any> {
    const { hostId, mediaId } = params;

    const where:any = {
      id: mediaId,
      hostId,
      isDeleted:0
    }
       
    const query: FindAndCountOptions<any> = {      
      attributes: {
        exclude: ['hostId', 'customerId', 'isDeleted', 'deletedAt'],
      },         
      where,
      raw: true,
      logging: console.log, // Enable logging for debugging
    };

    const mediaDetails = await CustomerMedia.findOne(query);
    return {
      data: mediaDetails
    };
  }

  async updateCustomer(params: any): Promise<any> {
    const { updatePayload, where } = params;
    const updateResult = await Customer.update(updatePayload, {
      where
    });
    return updateResult;
  }

  async updateCustomerAttributes(params: any): Promise<any> {
    const { updatePayload, where } = params;
    const updateResult = await CustomerAttribute.update(updatePayload, {
      where
    });
    return updateResult;
  }
}

export default new customerRepository();