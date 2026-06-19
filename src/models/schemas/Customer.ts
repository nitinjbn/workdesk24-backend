import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { CustomerAttributes } from '../../types';

interface CustomerCreationAttributes extends Optional<CustomerAttributes, 'id' | 'hostId' | 'customerCode' | 'customerName' | 'customerTypeId' | 'contactPerson' | 'mobile' | 'alternateMobile' | 'email' | 'gstNumber' | 'panNumber' | 'city' | 'state' | 'postalCode' | 'country' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class Customer extends Model<CustomerAttributes, CustomerCreationAttributes> implements CustomerAttributes {
  public id!: number;
  public hostId!: number;
  public customerCode?: string;
  public customerName!: string;
  public customerTypeId?: number;
  public contactPerson?: string;
  public mobile?: string;
  public alternateMobile?: string;
  public email?: string;
  public gstNumber?: string;
  public panNumber?: string;
  public addressLine1?: string;
  public addressLine2?: string;
  public city?: string;
  public state?: string;
  public postalCode?: string;
  public country?: string;
  public remarks?: string;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    Customer.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initCustomer(sequelize: Sequelize): typeof Customer {
  Customer.init(
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
      customerCode: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      customerName: {
        type: DataTypes.STRING(100),
        allowNull: false
      },
      customerTypeId: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      contactPerson: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      alternateMobile: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      gstNumber: {
        type: DataTypes.STRING(20),
        allowNull: true
       },
      panNumber: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      addressLine1: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      addressLine2: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      city: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      state: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      country: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
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
      tableName: 'wd_customers',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['customerCode'] },
        { fields: ['customerName'] },
        { fields: ['mobile'] },
        { fields: ['alternateMobile'] },
        { fields: ['email'] },
        { fields: ['gstNumber'] },
        { fields: ['panNumber'] },
        { fields: ['city'] },
        { fields: ['state'] },
        { fields: ['postalCode'] },
        { fields: ['country'] },
      ],
    }
  );

  return Customer;
}

export default Customer;
