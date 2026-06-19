import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { UserSettingsAttributes } from '../../types';

interface UserSettingsCreationAttributes extends Optional<UserSettingsAttributes, 'id' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class UserSettings extends Model<UserSettingsAttributes, UserSettingsCreationAttributes> implements UserSettingsAttributes {
  public id!: number;
  public userId!: number;
  public settingName!: string;
  public settingValue!: string;
  public remarks?: string;
  public isEnabled?: number;
  public createdAt!: number;
  public updatedAt!: number;
  public deletedAt!: number | null;
  public isDeleted?: number;

  public static associate(models: any): void {
    UserSettings.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initUserSettings(sequelize: Sequelize): typeof UserSettings {
  UserSettings.init(
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
      tableName: 'wd_user_settings',
      timestamps: false,
      underscored: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['settingName'] },
        { fields: ['settingValue'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return UserSettings;
}

export default UserSettings;
