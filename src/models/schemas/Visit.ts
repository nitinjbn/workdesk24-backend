import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { VisitAttributes } from '../../types';

interface VisitCreationAttributes extends Optional<VisitAttributes, 'id' | 'localId' | 'customerPhone' | 'customerEmail' | 'customerAddress' | 'checkInLatitude' | 'checkInLongitude' | 'purpose' | 'remarks' | 'checkOutTime' | 'visitDuration' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Visit extends Model<VisitAttributes, VisitCreationAttributes> implements VisitAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public customerId!: number;
  public customerName!: string;
  public customerPhone?: string;
  public customerEmail?: string;
  public customerAddress?: string;
  public checkInLatitude?: number;
  public checkOutLatitude?: number;
  public checkInLocationAccuracy?: number;
  public checkOutLocationAccuracy?: number;
  public checkInLocationAltitude?: number;
  public checkOutLocationAltitude?: number;
  public checkInLocationSpeed?: number;
  public checkOutLocationSpeed?: number;
  public checkInLocationProvider?: string;
  public checkOutLocationProvider?: string;
  public checkInBatteryPercentage?: number;
  public checkOutBatteryPercentage?: number;
  public isChargingOnCheckIn?: number;
  public isChargingOnCheckOut?: number;
  public purpose?: string;
  public remarks?: string;
  public checkInTime!: number;
  public checkOutTime?: number;
  public visitDuration?: number;
  public syncedAt?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public isDeleted?: number;
  public deletedAt?: number;

  public static associate(models: any): void {
    Visit.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Visit.hasMany(models.Image, {
      foreignKey: 'relatedId',
      constraints: false,
      scope: {
        relatedType: 'visit',
      },
      as: 'images',
    });
  }
}

export function initVisit(sequelize: Sequelize): typeof Visit {
  Visit.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      customerId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      customerName: {
        type: DataTypes.STRING(200),
        allowNull: false
      },
      customerCode: {
        type: DataTypes.STRING(50),
        allowNull: true
      },
      customerPhone: {
        type: DataTypes.STRING(20),
        allowNull: true
      },
      customerEmail: {
        type: DataTypes.STRING(255),
        allowNull: true
      },
      customerAddress: {
        type: DataTypes.TEXT,
        allowNull: true
      },
      purpose: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      remarks: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      checkInTime: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      checkOutTime: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      visitDuration: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      checkInLatitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      checkInLongitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      checkInLocationAccuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      checkInLocationAltitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      checkInLocationSpeed: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      checkInLocationProvider: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      checkInBatteryPercentage: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      isChargingOnCheckIn: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      checkOutLatitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      checkOutLongitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      checkOutLocationAccuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      checkOutLocationAltitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      checkOutLocationSpeed: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      checkOutLocationProvider: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      checkOutBatteryPercentage: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      isChargingOnCheckOut: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      syncedAt: {
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
      tableName: 'wd_visits',
      timestamps: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['localId'] },
        { fields: ['customerId'] },
        { fields: ['checkInTime'] },
        { fields: ['checkOutTime'] },
        { fields: ['visitDuration'] },
      ],
    }
  );

  return Visit;
}

export default Visit;
