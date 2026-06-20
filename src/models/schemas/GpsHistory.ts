import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { GpsHistoryAttributes } from '../../types';

interface GpsHistoryCreationAttributes extends Optional<GpsHistoryAttributes, 'id' | 'localId' | 'accuracy' | 'altitude' | 'speed' | 'provider' | 'batteryPercentage' | 'isCharging' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class GpsHistory extends Model<GpsHistoryAttributes, GpsHistoryCreationAttributes> implements GpsHistoryAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public localId?: string;
  public latitude!: number;
  public longitude!: number;
  public accuracy?: number;
  public altitude?: number;
  public speed?: number;
  public provider?: string;
  public batteryPercentage?: number;
  public isCharging?: number;
  public createdAt!: number;
  public updatedAt!: number | null;
  public syncedAt?: number;  
  public isDeleted!: number;
  public deletedAt?: number | null;

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
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true
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
      provider: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      batteryPercentage: {
        type: DataTypes.INTEGER,
        allowNull: true
      },
      isCharging: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true
      },      
      syncedAt: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
    },
    {
      sequelize,
      tableName: 'wd_gps_history',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { fields: ['localId'] },
      ],
    }
  );

  return GpsHistory;
}

export default GpsHistory;
