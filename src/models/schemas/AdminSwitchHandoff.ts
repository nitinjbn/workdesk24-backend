import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

interface AdminSwitchHandoffAttributes {
  id: number;
  tokenHash: string;
  userId: number;
  tokenFamily: string;
  expiresAt: number;
  consumedAt?: number | null;
  createdAt: number;
  updatedAt: number;
  isDeleted: number;
  deletedAt?: number | null;
}

interface AdminSwitchHandoffCreationAttributes
  extends Optional<AdminSwitchHandoffAttributes, 'id' | 'consumedAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class AdminSwitchHandoff
  extends Model<AdminSwitchHandoffAttributes, AdminSwitchHandoffCreationAttributes>
  implements AdminSwitchHandoffAttributes
{
  public id!: number;
  public tokenHash!: string;
  public userId!: number;
  public tokenFamily!: string;
  public expiresAt!: number;
  public consumedAt?: number | null;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt?: number | null;
}

export function initAdminSwitchHandoff(sequelize: Sequelize): typeof AdminSwitchHandoff {
  AdminSwitchHandoff.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      tokenHash: { type: DataTypes.STRING(64), allowNull: false },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      tokenFamily: { type: DataTypes.STRING(64), allowNull: false },
      expiresAt: { type: DataTypes.BIGINT, allowNull: false },
      consumedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
      createdAt: { type: DataTypes.BIGINT, allowNull: false },
      updatedAt: { type: DataTypes.BIGINT, allowNull: false },
      isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      tableName: 'wd_admin_switch_handoffs',
      timestamps: false,
      underscored: false,
      indexes: [
        { unique: true, fields: ['tokenHash'] },
        { fields: ['userId', 'tokenFamily', 'expiresAt'] },
      ],
    }
  );

  return AdminSwitchHandoff;
}

export default AdminSwitchHandoff;