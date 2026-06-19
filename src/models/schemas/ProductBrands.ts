import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { ProductBrandAttributes } from '../../types';

interface ProductBrandCreationAttributes extends Optional<ProductBrandAttributes, 'id' | 'brandName' | 'remarks' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class ProductBrand extends Model<ProductBrandAttributes, ProductBrandCreationAttributes> implements ProductBrandAttributes {
  public id!: number;
  public hostId!: number;
  public brandName!: string;
  public remarks?: string;
  public parentCategoryId?: number;
  public sortOrder?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    ProductBrand.belongsTo(models.User, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initProductBrand(sequelize: Sequelize): typeof ProductBrand {
  ProductBrand.init(
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
      brandName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      remarks: {
        type: DataTypes.STRING(255),
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
      tableName: 'wd_product_brands',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['brandName'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return ProductBrand;
}

export default ProductBrand;
