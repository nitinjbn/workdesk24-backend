import db, { Product, ProductCategory, ProductBrand, ProductMedia, ProductAttribute } from '../../../models';

export class ProductRepository {
  async getProducts(payload) {
    const { hostId, userId } = payload;

    const query = {
      attributes: {
        exclude: ['id', 'categoryId', 'brandId', 'uomId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
        include: [
          [db.Sequelize.col('Product.id'), 'productId'],
          [db.Sequelize.col('productCategoryDetails.categoryName'), 'category'],
          [db.Sequelize.col('productBrandDetails.brandName'), 'brand']
        ]
      },
      where: {
        hostId: hostId,
        isDeleted:0,
        isEnabled: 1
      },
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
            exclude: ['id', 'hostId', 'productId', 'isEnabled', 'isDeleted', 'deletedAt', 'createdAt', 'updatedAt'],
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
      logging: console.log
    }

    const rows = await Product.findAll(query as any);
    const products = rows.map((product:any) => {
      const data = product.toJSON();
      data.productAttribute = this.groupProductAttributes(data.productAttribute);
      return data;
    });

    return products;
  }

  private groupProductAttributes(attributes = []) {
    const groups = {};

    for (const attribute of attributes) {
      const group = attribute.attributeGroup || "General";

      if (!groups[group]) {
        groups[group] = [];
      }

      groups[group].push({
        attributeName: attribute.attributeName,
        attributeValue: attribute.attributeValue,
        attributeType: attribute.attributeType,
        attributeUomId: attribute.attributeUomId,
        sortOrder: attribute.sortOrder
      });
    }

    return Object.entries(groups).map(([groupName, attributes]) => ({
      groupName,
      attributes
    }));
  }
}

export default new ProductRepository();