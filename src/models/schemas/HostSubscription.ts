import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { HostSubscriptionAttributes } from '../../types';

interface HostSubscriptionCreationAttributes extends Optional<HostSubscriptionAttributes, 'id' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class HostSubscription extends Model<HostSubscriptionAttributes , HostSubscriptionCreationAttributes > implements HostSubscriptionAttributes {
  public id!: number;
  public hostId!: number;
  public licensedUserCount!: number;
  public subscriptionCycleId!: number;
  public validityInMonths!: number;
  public perUserMonthlyPrice!: number;
  public perUserSetupPrice!: number;
  public discountType?: 'PERCENTAGE' | 'FIXED';
  public discountValue?: number;
  public grossAmount!: number;
  public discountAmount!: number;
  public netAmount!: number;
  public planStartDate!: number;
  public planEndDate!: number;
  public paymentStatus!: 'PENDING' | 'PAID';
  public paymentReference?: string;
  public remarks?: string;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    HostSubscription.belongsTo(models.SubscriptionCycle, {
      foreignKey: 'subscriptionCycleId',
      as: 'subscriptionCycle',
    });
    HostSubscription.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initHostSubscription(sequelize: Sequelize): typeof HostSubscription {
  HostSubscription.init(
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
      subscriptionCycleId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      licensedUserCount: {
        type: DataTypes.INTEGER,
        allowNull: false,
      },
      validityInMonths: {
        type: DataTypes.SMALLINT,
        allowNull: false,
      },
      perUserMonthlyPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      perUserSetupPrice: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      discountType: {
        type: DataTypes.ENUM('PERCENTAGE', 'FIXED'),
        allowNull: true,
      },
      discountValue: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: true,
      },
      grossAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      discountAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      netAmount: {
        type: DataTypes.DECIMAL(10, 2),
        allowNull: false,
      },
      planStartDate: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      planEndDate: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      paymentStatus: {
        type: DataTypes.ENUM('PENDING', 'PAID'),
        allowNull: false,
      },
      paymentReference: {
        type: DataTypes.STRING(255),
        allowNull: true,
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
      tableName: 'wd_host_subscriptions',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['subscriptionCycleId'] },
        { fields: ['licensedUserCount'] },
        { fields: ['discountType'] },
        { fields: ['discountValue'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return HostSubscription;
}

export default HostSubscription;