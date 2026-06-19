import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { RolePermissionAttributes } from '../../types';

interface RolePermissionCreationAttributes extends Optional<RolePermissionAttributes, 'id' | 'roleId' | 'permissionId' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class RolePermission extends Model<RolePermissionAttributes, RolePermissionCreationAttributes> implements RolePermissionAttributes {
  public id!: number;
  public hostId!: number;
  public roleId!: number;
  public permissionId!: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    RolePermission.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
    RolePermission.belongsTo(models.Role, {
      foreignKey: 'roleId',
      as: 'role',
    });
    RolePermission.belongsTo(models.Permission, {
      foreignKey: 'permissionId',
      as: 'permission',
    });
  }
}

export function initRolePermission(sequelize: Sequelize): typeof RolePermission {
  RolePermission.init(
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
      roleId: {
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
      tableName: 'wd_role_permissions',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['roleId'] },
        { fields: ['permissionId'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
        { fields: ['hostId', 'roleId', 'permissionId'] },
      ],
    }
  );

  return RolePermission;
}

export default RolePermission;