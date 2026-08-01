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