import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { UserPermissionAttributes } from '../../types';

interface UserPermissionCreationAttributes extends Optional<UserPermissionAttributes, 'id' | 'userId' | 'permissionId' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class UserPermission extends Model<UserPermissionAttributes, UserPermissionCreationAttributes> implements UserPermissionAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public permissionId!: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    UserPermission.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
    UserPermission.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    UserPermission.belongsTo(models.Permission, {
      foreignKey: 'permissionId',
      as: 'permission',
    });
  }
}

export function initUserPermission(sequelize: Sequelize): typeof UserPermission {
  UserPermission.init(
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
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      permissionId: {
        type: DataTypes.BIGINT,
        allowNull: false,
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
      tableName: 'wd_user_permissions',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { fields: ['permissionId'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
        { fields: ['hostId', 'userId', 'permissionId'] },
      ],
    }
  );

  return UserPermission;
}

export default UserPermission;