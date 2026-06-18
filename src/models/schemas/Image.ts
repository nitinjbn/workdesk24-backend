import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { ImageAttributes } from '../../types';

interface ImageCreationAttributes extends Optional<ImageAttributes, 'id' | 'localId' | 'visitId' | 'latitude' | 'longitude' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Image extends Model<ImageAttributes, ImageCreationAttributes> implements ImageAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public visitId?: number;
  public caption!: string;
  public mediaUrl?: string;
  public mediaType?: string;
  public capturedAt!: number;
  public latitude?: number;
  public longitude?: number;
  public syncedAt?: number;
  public createdAt?: number;
  public updatedAt?: number;

  public static associate(models: any): void {
    Image.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Image.belongsTo(models.Visit, {
      foreignKey: 'visitId',
      as: 'visit',
    });
  }
}

export function initImage(sequelize: Sequelize): typeof Image {
  Image.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      visitId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      caption: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      mediaUrl: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      mediaType: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      capturedAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      locationAccuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationAltitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationSpeed: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationProvider: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      batteryPercentage: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      isCharging: {
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
      tableName: 'wd_images',
      timestamps: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['localId'] },
        { fields: ['visitId'] },
        { fields: ['capturedAt'] }
      ],
    }
  );

  return Image;
}

export default Image;
