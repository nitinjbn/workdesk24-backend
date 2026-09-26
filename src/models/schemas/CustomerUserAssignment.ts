import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { CustomerUserAssignmentAttributes } from '../../types';

interface CustomerUserAssignmentCreationAttributes extends Optional<
  CustomerUserAssignmentAttributes,
  'id' | 'createdAt' | 'updatedAt'
> {}

class CustomerUserAssignment
  extends Model<CustomerUserAssignmentAttributes, CustomerUserAssignmentCreationAttributes>
  implements CustomerUserAssignmentAttributes
{
  public id!: number;
  public hostId!: number;
  public customerId!: number;
  public userId!: number;
  public createdAt!: number;
  public updatedAt?: number;
  public isDeleted?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    CustomerUserAssignment.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    CustomerUserAssignment.belongsTo(models.Customer, {
      foreignKey: 'customerId',
      as: 'customer',
    });

    CustomerUserAssignment.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initCustomerUserAssignment(sequelize: Sequelize): typeof CustomerUserAssignment {
  CustomerUserAssignment.init(
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
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
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
      tableName: 'wd_customer_user_assignments',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['customerId'] },
        { fields: ['userId'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return CustomerUserAssignment;
}

export default CustomerUserAssignment;
