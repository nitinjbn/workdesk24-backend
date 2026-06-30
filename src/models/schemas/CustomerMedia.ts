import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { CustomerMediaAttributes } from '../../types';

interface CustomerMediaCreationAttributes extends Optional<CustomerMediaAttributes, 'id' | 'hostId' | 'customerId' | 'mediaUrl' | 'mediaType' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class CustomerMedia extends Model<CustomerMediaAttributes, CustomerMediaCreationAttributes> implements CustomerMediaAttributes {
  public id!: number;
  public hostId!: number;
  public customerId!: number;
  public mediaUrl!: string;
  public mediaType!: 'IMAGE' | 'VIDEO' | 'PDF' | 'DOCUMENT' | 'BROCHURE' | 'CERTIFICATE' | 'LABEL' | 'MANUAL';
  public thumbnailUrl?: string;
  public publicId?: string;
  public fileName?: string;
  public fileSizeInBytes?: number;
  public mimeType?: string;
  public isPrimary?: number;
  public sortOrder?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    CustomerMedia.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    CustomerMedia.belongsTo(models.Customer, {
      foreignKey: 'customerId',
      as: 'customerMedia',
    });
  }
}

export function initCustomerMedia(sequelize: Sequelize): typeof CustomerMedia {
  CustomerMedia.init(
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
      mediaUrl: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      mediaType: {
        type: DataTypes.ENUM('IMAGE','VIDEO','PDF','DOCUMENT','BROCHURE','CERTIFICATE','LABEL','MANUAL'),
        allowNull: false,
      },
      thumbnailUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      publicId: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      fileName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      fileSizeInBytes: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      mimeType: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      isPrimary: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
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
      tableName: 'wd_customer_media',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['customerId'] },
        { fields: ['mediaUrl'] },
        { fields: ['mediaType'] },
        { fields: ['isPrimary'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return CustomerMedia;
}

export default CustomerMedia;
