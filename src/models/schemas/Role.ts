import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { RoleAttributes } from '../../types';

interface RoleCreationAttributes extends Optional<RoleAttributes, 'id' | 'roleCode' | 'roleName' | 'remarks' | 'isSystemRole' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class Role extends Model<RoleAttributes, RoleCreationAttributes> implements RoleAttributes {
  public id!: number;
  public hostId!: number;
  public roleCode!: string;
  public roleName!: string;
  public remarks?: string;
  public isSystemRole?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    Role.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initRole(sequelize: Sequelize): typeof Role {
  Role.init(
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
      roleCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      roleName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      remarks: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isSystemRole: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
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
      tableName: 'wd_roles',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['roleCode'] },
        { fields: ['roleName'] },
        { fields: ['isSystemRole'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return Role;
}

export default Role;