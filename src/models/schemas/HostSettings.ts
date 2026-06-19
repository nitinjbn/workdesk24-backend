import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { HostSettingsAttributes } from '../../types';

interface HostSettingsCreationAttributes extends Optional<HostSettingsAttributes, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class HostSettings extends Model<HostSettingsAttributes, HostSettingsCreationAttributes> implements HostSettingsAttributes {
  public id!: number;
  public hostId!: number;
  public settingName!: string;
  public settingValue!: string;
  public remarks?: string;
  public isEnabled?: number;
  public createdAt!: number;
  public updatedAt!: number;
  public deletedAt!: number | null;
  public isDeleted?: number;

  public static associate(models: any): void {
    HostSettings.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initHostSettings(sequelize: Sequelize): typeof HostSettings {
  HostSettings.init(
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
      settingName: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      settingValue: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      isEnabled: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'createdAt',
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'updatedAt',
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
        field: 'isDeleted',
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
        field: 'deletedAt',
      },
    },
    {
      sequelize,
      tableName: 'wd_host_settings',
      timestamps: false,
      underscored: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['settingName'] },
        { fields: ['settingValue'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return HostSettings;
}

export default HostSettings;
