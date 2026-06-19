import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { ProductAttributes } from '../../types';

interface ProductCreationAttributes extends Optional<ProductAttributes, 'id' | 'productCode' | 'shortName' | 'description' | 'categoryId' | 'brandId' | 'uomId' | 'sku' | 'barcode' | 'hsnCode' | 'purchasePrice' | 'sellingPrice' | 'mrp' | 'taxPercentage' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class Product extends Model<ProductAttributes, ProductCreationAttributes> implements ProductAttributes {
  public id!: number;
  public hostId!: number;
  public productCode?: string;
  public productName!: string;
  public shortName?: string;
  public description?: string;
  public categoryId?: number;
  public brandId?: number;
  public uomId?: number;
  public sku?: string;
  public barcode?: string;
  public hsnCode?: string;
  public purchasePrice?: number;
  public sellingPrice?: number;
  public mrp?: number;
  public taxPercentage?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    Product.belongsTo(models.User, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initProduct(sequelize: Sequelize): typeof Product {
  Product.init(
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
      productCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      productName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      shortName: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      categoryId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      brandId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      uomId: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      sku: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      barcode: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      hsnCode: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      purchasePrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      sellingPrice: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      mrp: {
        type: DataTypes.DECIMAL(12, 2),
        allowNull: true,
      },
      taxPercentage: {
        type: DataTypes.DECIMAL(5, 2),
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
      tableName: 'wd_products',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['productCode'] },
        { fields: ['productName'] },
        { fields: ['categoryId'] },
        { fields: ['brandId'] },
        { fields: ['uomId'] },
        { fields: ['sku'] },
        { fields: ['barcode'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return Product;
}

export default Product;
