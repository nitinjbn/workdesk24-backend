import { FindAndCountOptions, Op} from 'sequelize';
import db, { Product, ProductAttribute, ProductBrand, ProductMedia, ProductCategory } from '../../../models';
import { GetProductsPayload, GetProductDetailsByIdPayload, ReportResponse, SingleRecordResponse, ProductMediaResponse, GetProductMediaDetailsByIdPayload, GetProductAttributesDetailsByIdPayload} from '../types/product.types';
import baseReportHelper from '../helpers/base-report.helper';
import { buildCommonReportOrder } from './user-scoped-report.helper';

type ProductInstance = typeof Product.prototype;

export class productRepository {
  async getCategories(params: { hostId: number, filter?: Record<string, unknown>, page?: number, limit?: number, sortBy?: string, sortOrder?: 'ASC' | 'DESC' }): Promise<ReportResponse<any>> {
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
      if(filter.categoryName) {
        where.categoryName = {
          [Op.like]: `%${(filter.categoryName as string).trim()}%`,
        }
      }
    }
    const query: FindAndCountOptions<any> = {
      attributes: {
        exclude: ['hostId', 'isDeleted', 'deletedAt'],
        include: [
          [db.Sequelize.col('ProductCategory.id'), 'categoryId']
        ]
      },
      where,
      order,
      logging: console.log, // Enable logging for debugging
    };

    if(page && limit) {
      query.limit = limit;
      query.offset = offset;

      const { rows, count } = await ProductCategory.findAndCountAll(query);

      return {
        data: rows,
        pagination: baseReportHelper.buildPagination(count, page, limit),
      };
    } else {
      const rows = await ProductCategory.findAll(query);
      return {
        data: rows
      };
    }
  }

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
        exclude: ['hostId', 'isDeleted', 'deletedAt'],
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

  async getProducts(params: GetProductsPayload): Promise<ReportResponse<ProductInstance>> {
    const { page, limit, filter, hostId, sortBy, sortOrder } = params;
    const { offset } = baseReportHelper.normalizePagination({ page, limit });
    // const order = buildCommonReportOrder(sortBy, sortOrder, {
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
      if(filter.productCategoryId) {
        where.categoryId = filter.productCategoryId;
      }
      if(filter.productBrandId) {
        where.brandId = filter.productBrandId;
      }
    }
   
    const query: FindAndCountOptions<ProductInstance> = {
      attributes: {
        exclude: ['id', 'categoryId', 'brandId', 'uomId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
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
          required: true
        },
        {
          attributes:[],
          model: ProductBrand,
          where: {
            isDeleted: 0
          },
          as: "productBrandDetails",
          required: true
        },
        {
          attributes: {
            exclude: ['hostId', 'productId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
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
      order,
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

  async getProductById(params: GetProductDetailsByIdPayload): Promise<SingleRecordResponse<ProductInstance>> {
    const { hostId, productId } = params;

    const where:any = {
      id: productId,
      hostId,
      isDeleted:0
    }
   
    const query: FindAndCountOptions<ProductInstance> = {
      attributes: {
        exclude: ['id', 'categoryId', 'brandId', 'uomId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
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
          required: true
        },
        {
          attributes:[],
          model: ProductBrand,
          where: {
            isDeleted: 0
          },
          as: "productBrandDetails",
          required: true
        },
        {
          attributes: {
            exclude: ['hostId', 'productId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
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
      data: productDetails || {}
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
}

export default new productRepository();