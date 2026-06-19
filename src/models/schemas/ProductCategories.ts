import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { ProductCategoryAttributes } from '../../types';

interface ProductCategoryCreationAttributes extends Optional<ProductCategoryAttributes, 'id' | 'categoryName' | 'description' | 'parentCategoryId' | 'sortOrder' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class ProductCategory extends Model<ProductCategoryAttributes, ProductCategoryCreationAttributes> implements ProductCategoryAttributes {
  public id!: number;
  public hostId!: number;
  public categoryName!: string;
  public description?: string;
  public parentCategoryId?: number;
  public sortOrder?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    ProductCategory.belongsTo(models.User, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initProductCategory(sequelize: Sequelize): typeof ProductCategory {
  ProductCategory.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      categoryName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      parentCategoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      sortOrder: {
        type: DataTypes.TINYINT,
        allowNull: true,
      },
      isEnabled: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_product_categories',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['categoryName'] },
        { fields: ['description'] },
        { fields: ['parentCategoryId'] },
        { fields: ['sortOrder'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return ProductCategory;
}

export default ProductCategory;
