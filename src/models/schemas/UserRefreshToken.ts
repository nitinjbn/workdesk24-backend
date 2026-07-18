import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

interface UserRefreshTokenAttributes {
  id: number;
  hostId: number;
  userId: number;
  tokenHash: string;
  tokenFamily: string;
  deviceType: 'WEB' | 'ANDROID' | 'IOS';
  deviceId: string;
  deviceName?: string | null;
  appVersion?: string | null;
  lastUsedAt?: number | null;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;  
  replacedByTokenHash?: string | null;
  isRevoked: number;
  revokedReason?: string | null;
  revokedAt?: number | null;
}

interface UserRefreshTokenCreationAttributes
  extends Optional<UserRefreshTokenAttributes, 'id' | 'createdAt' | 'updatedAt' | 'revokedAt' | 'replacedByTokenHash' | 'isRevoked'> {}

class UserRefreshToken
  extends Model<UserRefreshTokenAttributes, UserRefreshTokenCreationAttributes>
  implements UserRefreshTokenAttributes {
  public id!: number;
  public hostId!: number;
  public userId!: number;
  public tokenHash!: string;
  public tokenFamily!: string;
  public deviceType!: 'WEB' | 'ANDROID' | 'IOS';
  public deviceId!: string;
  public deviceName?: string | null;
  public appVersion?: string | null;
  public expiresAt!: number;
  public lastUsedAt?: number | null;
  public createdAt!: number;
  public updatedAt!: number;  
  public replacedByTokenHash?: string | null;
  public isRevoked!: number;
  public revokedReason?: string | null;
  public revokedAt?: number | null;
}

export function initUserRefreshToken(sequelize: Sequelize): typeof UserRefreshToken {
  UserRefreshToken.init(
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
      tokenHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
      },
      tokenFamily: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      deviceType: {
        type: DataTypes.ENUM('WEB', 'ANDROID', 'IOS'),
        allowNull: false,
      },
      deviceId: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      deviceName: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      appVersion: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      expiresAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      lastUsedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },      
      replacedByTokenHash: {
        type: DataTypes.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      isRevoked: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      revokedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
      revokedReason: {
        type: DataTypes.STRING(50),
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_user_refresh_tokens',
      timestamps: false,
      underscored: false,
      hooks: {
        beforeCreate: (token: UserRefreshToken) => {
          const now = Math.floor(Date.now() / 1000);
          if (!token.createdAt) {
            token.createdAt = now;
          }
          if (!token.updatedAt) {
            token.updatedAt = now;
          }
          if (token.isRevoked === undefined) {
            token.isRevoked = 0;
          }
        },
        beforeUpdate: (token: UserRefreshToken) => {
          token.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { unique: true, fields: ['hostId', 'userId', 'deviceId'] },
        { unique: true, fields: ['tokenHash'] },
        { fields: ['tokenFamily'] },
        { fields: ['expiresAt'] },
        { fields: ['isRevoked'] },
      ]
    }
  );

  return UserRefreshToken;
}

export default UserRefreshToken;