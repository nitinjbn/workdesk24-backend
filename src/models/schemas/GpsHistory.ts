import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { GpsHistoryAttributes } from '../../types';

interface GpsHistoryCreationAttributes extends Optional<GpsHistoryAttributes, 'id' | 'localId' | 'accuracy' | 'altitude' | 'speed' | 'bearing' | 'batteryLevel' | 'activityType' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class GpsHistory extends Model<GpsHistoryAttributes, GpsHistoryCreationAttributes> implements GpsHistoryAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public latitude!: number;
  public longitude!: number;
  public accuracy?: number;
  public altitude?: number;
  public speed?: number;
  public bearing?: number;
  public recordedAt!: Date;
  public batteryLevel?: number;
  public activityType?: string;
  public syncedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static associate(models: any): void {
    GpsHistory.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initGpsHistory(sequelize: Sequelize): typeof GpsHistory {
  GpsHistory.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'local_id',
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: false,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: false,
      },
      accuracy: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      altitude: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      speed: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      bearing: {
        type: DataTypes.FLOAT,
        allowNull: true,
      },
      recordedAt: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'recorded_at',
      },
      batteryLevel: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'battery_level',
      },
      activityType: {
        type: DataTypes.STRING(50),
        allowNull: true,
        field: 'activity_type',
      },
      syncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        },
    },
    {
      sequelize,
      tableName: 'wd_gps_history',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['recorded_at'] },
        { fields: ['local_id'] },
      ],
    }
  );

  return GpsHistory;
}

export default GpsHistory;
