import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { UserLastLocationAttributes } from '../../types';

interface UserLastLocationCreationAttributes extends Optional<UserLastLocationAttributes, 'id' | 'localId' | 'accuracy' | 'altitude' | 'speed' | 'provider' | 'batteryPercentage' | 'isCharging' | 'locationTime'> {}

class UserLastLocation extends Model<UserLastLocationAttributes, UserLastLocationCreationAttributes> implements UserLastLocationAttributes {
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
  public locationTime!: number;

  public static associate(models: any): void {
    UserLastLocation.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initUserLastLocation(sequelize: Sequelize): typeof UserLastLocation {
  UserLastLocation.init(
    {
      id: {
        type: DataTypes.BIGINT.UNSIGNED,
        autoIncrement: true,
        allowNull: false,
        primaryKey: true
      },
      hostId: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false
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
      locationTime: {
        type: DataTypes.BIGINT,
        allowNull: false
      }
    },
    {
      sequelize,
      tableName: 'wd_user_last_locations',
      timestamps: false,
      indexes: [
        {
          unique: true,
          fields: ['hostId', 'userId'],
          name: 'uq_host_user',
        },
        {
          fields: ['locationTime'],
          name: 'idx_locationTime',
        },
      ],
    }
  );

  return UserLastLocation;
}

export default UserLastLocation;
