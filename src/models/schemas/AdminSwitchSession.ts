import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

interface AdminSwitchSessionAttributes {
  id: number;
  switchSessionId: string;
  userId: number;
  originalHostId: number;
  sourceTokenFamily: string;
  currentHostId: number;
  tokenFamily: string;
  deviceId: string;
  currentRefreshTokenId?: number | null;
  contextVersion: number;
  isActive: number;
  startedAt: number;
  createdAt: number;
  updatedAt: number;
  endedAt?: number | null;
  isDeleted: number;
  deletedAt?: number | null;
}

interface AdminSwitchSessionCreationAttributes
  extends Optional<AdminSwitchSessionAttributes, 'id' | 'currentRefreshTokenId' | 'updatedAt' | 'endedAt' | 'isDeleted' | 'deletedAt'> {}

class AdminSwitchSession
  extends Model<AdminSwitchSessionAttributes, AdminSwitchSessionCreationAttributes>
  implements AdminSwitchSessionAttributes
{
  public id!: number;
  public switchSessionId!: string;
  public userId!: number;
  public originalHostId!: number;
  public sourceTokenFamily!: string;
  public currentHostId!: number;
  public tokenFamily!: string;
  public deviceId!: string;
  public currentRefreshTokenId?: number | null;
  public contextVersion!: number;
  public isActive!: number;
  public startedAt!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public endedAt?: number | null;
  public isDeleted!: number;
  public deletedAt?: number | null;
}

export function initAdminSwitchSession(sequelize: Sequelize): typeof AdminSwitchSession {
  AdminSwitchSession.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      switchSessionId: { type: DataTypes.STRING(36), allowNull: false },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      originalHostId: { type: DataTypes.BIGINT, allowNull: false },
      sourceTokenFamily: { type: DataTypes.STRING(64), allowNull: false },
      currentHostId: { type: DataTypes.BIGINT, allowNull: false },
      tokenFamily: { type: DataTypes.STRING(64), allowNull: false },
      deviceId: { type: DataTypes.STRING(255), allowNull: false },
      currentRefreshTokenId: { type: DataTypes.BIGINT, allowNull: true },
      contextVersion: { type: DataTypes.INTEGER, allowNull: false, defaultValue: 1 },
      isActive: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
      startedAt: { type: DataTypes.BIGINT, allowNull: false },
      createdAt: { type: DataTypes.BIGINT, allowNull: false },
      updatedAt: { type: DataTypes.BIGINT, allowNull: false },
      endedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
      isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      tableName: 'wd_admin_switch_sessions',
      timestamps: false,
      underscored: false,
      indexes: [
        { unique: true, fields: ['switchSessionId'] },
        { fields: ['userId', 'isActive'] },
        { fields: ['tokenFamily'] },
        { fields: ['userId', 'sourceTokenFamily', 'isActive'] },
        { fields: ['currentHostId', 'isActive'] },
      ],
    }
  );

  return AdminSwitchSession;
}

export default AdminSwitchSession;