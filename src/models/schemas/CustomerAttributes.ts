import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { CustomerAttributeAttributes } from '../../types';

interface CustomerAttributeCreationAttributes extends Optional<CustomerAttributeAttributes, 'id' | 'hostId' | 'customerId' | 'attributeGroup' | 'attributeName' | 'attributeValue' | 'attributeType' | 'attributeUomId' | 'sortOrder' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class CustomerAttribute extends Model<CustomerAttributeAttributes, CustomerAttributeCreationAttributes> implements CustomerAttributeAttributes {
  public id!: number;
  public hostId!: number;
  public customerId!: number;
  public attributeGroup!: string;
  public attributeName!: string;
  public attributeValue!: string;
  public attributeType!: 'TEXT' | 'NUMBER' | 'DECIMAL' | 'DATE' | 'BOOLEAN' | 'JSON';
  public attributeUomId?: number;
  public sortOrder?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    CustomerAttribute.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initCustomerAttribute(sequelize: Sequelize): typeof CustomerAttribute {
  CustomerAttribute.init(
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
      customerId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      attributeGroup: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      attributeName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      attributeValue: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      attributeType: {
        type: DataTypes.ENUM('TEXT','NUMBER','DECIMAL','DATE','BOOLEAN','JSON'),
        allowNull: false,
      },
      attributeUomId: {
        type: DataTypes.BIGINT,
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
      tableName: 'wd_customer_attributes',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['customerId'] },
        { fields: ['attributeGroup'] },
        { fields: ['attributeName'] },
        { fields: ['attributeValue'] },
        { fields: ['attributeType'] },
        { fields: ['attributeUomId'] },
        { fields: ['sortOrder'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return CustomerAttribute;
}

export default CustomerAttribute;
