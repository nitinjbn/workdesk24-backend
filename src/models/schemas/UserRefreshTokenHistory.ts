import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

interface UserRefreshTokenHistoryAttributes {
  id: number;
  refreshTokenId: number;
  hostId: number;
  userId: number;
  tokenHash: string;
  tokenFamily: string;
  deviceType: 'WEB' | 'ANDROID' | 'IOS';
  deviceId: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  revokedAt: number;
  replacedByTokenHash?: string | null;
  revokedReason: string;
  isDeleted: number;
  deletedAt?: number | null;
  switchSessionId?: string | null;
  contextVersion?: number | null;
}

interface UserRefreshTokenHistoryCreationAttributes
  extends Optional<UserRefreshTokenHistoryAttributes, 'id' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class UserRefreshTokenHistory
  extends Model<UserRefreshTokenHistoryAttributes, UserRefreshTokenHistoryCreationAttributes>
  implements UserRefreshTokenHistoryAttributes
{
  public id!: number;
  public refreshTokenId!: number;
  public hostId!: number;
  public userId!: number;
  public tokenHash!: string;
  public tokenFamily!: string;
  public deviceType!: 'WEB' | 'ANDROID' | 'IOS';
  public deviceId!: string;
  public expiresAt!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public revokedAt!: number;
  public replacedByTokenHash?: string | null;
  public revokedReason!: string;
  public isDeleted!: number;
  public deletedAt?: number | null;
  public switchSessionId?: string | null;
  public contextVersion?: number | null;
}

export function initUserRefreshTokenHistory(sequelize: Sequelize): typeof UserRefreshTokenHistory {
  UserRefreshTokenHistory.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      refreshTokenId: { type: DataTypes.BIGINT, allowNull: false },
      hostId: { type: DataTypes.BIGINT, allowNull: false },
      userId: { type: DataTypes.BIGINT, allowNull: false },
      tokenHash: { type: DataTypes.STRING(128), allowNull: false },
      tokenFamily: { type: DataTypes.STRING(64), allowNull: false },
      deviceType: { type: DataTypes.ENUM('WEB', 'ANDROID', 'IOS'), allowNull: false },
      deviceId: { type: DataTypes.STRING(255), allowNull: false },
      expiresAt: { type: DataTypes.BIGINT, allowNull: false },
      createdAt: { type: DataTypes.BIGINT, allowNull: false },
      updatedAt: { type: DataTypes.BIGINT, allowNull: false },
      revokedAt: { type: DataTypes.BIGINT, allowNull: false },
      replacedByTokenHash: { type: DataTypes.STRING(128), allowNull: true },
      revokedReason: { type: DataTypes.STRING(50), allowNull: false },
      isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
      switchSessionId: { type: DataTypes.STRING(36), allowNull: true, defaultValue: null },
      contextVersion: { type: DataTypes.INTEGER, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      tableName: 'wd_user_refresh_token_history',
      timestamps: false,
      underscored: false,
      indexes: [
        { unique: true, fields: ['tokenHash'] },
        { fields: ['refreshTokenId'] },
        { fields: ['userId', 'tokenFamily'] },
        { fields: ['switchSessionId'] },
      ],
    }
  );

  return UserRefreshTokenHistory;
}

export default UserRefreshTokenHistory;