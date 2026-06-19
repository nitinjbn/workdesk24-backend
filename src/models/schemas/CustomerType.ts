import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { CustomerTypeAttributes } from '../../types';

interface CustomerTypeCreationAttributes extends Optional<CustomerTypeAttributes, 'id' | 'createdAt' | 'updatedAt'> {}

class CustomerType extends Model<CustomerTypeAttributes, CustomerTypeCreationAttributes> implements CustomerTypeAttributes {
  public id!: number;
  public hostId!: number;
  public customerTypeName!: string;
  public sortOrder!: number;
  public isEnabled!: number;
  public createdAt!: number;
  public updatedAt?: number;
  public isDeleted?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    CustomerType.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initCustomerType(sequelize: Sequelize): typeof CustomerType {
  CustomerType.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      customerTypeName: {
        type: DataTypes.STRING(50), // Distributor, Retailer, Wholesaler, Pharmacy, Hospital, Corporate, Customer, Other
        allowNull: false
      },
      sortOrder: {
        type: DataTypes.TINYINT,
        defaultValue: 0,
        allowNull: false
      },
      isEnabled: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_customer_types',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['customerTypeName'] },
        { fields: ['sortOrder'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return CustomerType;
}

export default CustomerType;