import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { PermissionAttributes } from '../../types';

interface PermissionCreationAttributes extends Optional<PermissionAttributes, 'id' | 'permissionCode' | 'permissionName' | 'moduleName' | 'remarks' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class Permission extends Model<PermissionAttributes, PermissionCreationAttributes> implements PermissionAttributes {
  public id!: number;
  public hostId!: number;
  public permissionCode!: string;
  public permissionName!: string;
  public moduleName!: string;
  public remarks?: string;
  public isSystemRole?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;
}

export function initPermission(sequelize: Sequelize): typeof Permission {
  Permission.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      permissionCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      permissionName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      moduleName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      remarks: {
        type: DataTypes.STRING(255),
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
      tableName: 'wd_permissions',
      timestamps: false,
      indexes: [
        { fields: ['permissionCode'] },
        { fields: ['permissionName'] },
        { fields: ['moduleName'] },
        { fields: ['isSystemRole'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return Permission;
}

export default Permission;