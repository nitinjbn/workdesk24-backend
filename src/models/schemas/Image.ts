import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { ImageAttributes } from '../../types';

interface ImageCreationAttributes extends Optional<ImageAttributes, 'id' | 'localId' | 'relatedId' | 'originalName' | 'fileSize' | 'mimeType' | 'base64Data' | 'width' | 'height' | 'latitude' | 'longitude' | 'capturedAt' | 'description' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Image extends Model<ImageAttributes, ImageCreationAttributes> implements ImageAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public relatedType!: 'visit' | 'order' | 'payment' | 'feedback' | 'attendance' | 'profile' | 'other';
  public relatedId?: number;
  public fileName!: string;
  public originalName?: string;
  public filePath!: string;
  public fileSize?: number;
  public mimeType?: string;
  public base64Data?: string;
  public width?: number;
  public height?: number;
  public latitude?: number;
  public longitude?: number;
  public capturedAt?: number;
  public description?: string;
  public syncedAt?: number;
  public createdAt?: number;
  public updatedAt?: number;

  public static associate(models: any): void {
    Image.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initImage(sequelize: Sequelize): typeof Image {
  Image.init(
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
      relatedType: {
        type: DataTypes.ENUM('visit', 'order', 'payment', 'feedback', 'attendance', 'profile', 'other'),
        allowNull: false,
        field: 'related_type',
      },
      relatedId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'related_id',
      },
      fileName: {
        type: DataTypes.STRING(255),
        allowNull: false,
        field: 'file_name',
      },
      originalName: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'original_name',
      },
      filePath: {
        type: DataTypes.STRING(500),
        allowNull: false,
        field: 'file_path',
      },
      fileSize: {
        type: DataTypes.INTEGER,
        allowNull: true,
        field: 'file_size',
      },
      mimeType: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'mime_type',
      },
      base64Data: {
        type: DataTypes.TEXT('long'),
        allowNull: true,
        field: 'base64_data',
      },
      width: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      height: {
        type: DataTypes.INTEGER,
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
      capturedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'captured_at',
      },
      description: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      syncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        },
    },
    {
      sequelize,
      tableName: 'wd_images',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['local_id'] },
        { fields: ['related_type', 'related_id'] },
        { fields: ['captured_at'] },
      ],
    }
  );

  return Image;
}

export default Image;
