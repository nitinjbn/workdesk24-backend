import { Model, DataTypes, Sequelize, Optional } from 'sequelize';

interface AdminRefreshTokenAttributes {
  id: number;
  userId: number;
  tokenHash: string;
  tokenFamily: string;
  expiresAt: number;
  createdAt: number;
  updatedAt: number;
  revokedAt?: number | null;
  replacedByTokenHash?: string | null;
  isRevoked: number;
}

interface AdminRefreshTokenCreationAttributes
  extends Optional<AdminRefreshTokenAttributes, 'id' | 'createdAt' | 'updatedAt' | 'revokedAt' | 'replacedByTokenHash' | 'isRevoked'> {}

class AdminRefreshToken
  extends Model<AdminRefreshTokenAttributes, AdminRefreshTokenCreationAttributes>
  implements AdminRefreshTokenAttributes {
  public id!: number;
  public userId!: number;
  public tokenHash!: string;
  public tokenFamily!: string;
  public expiresAt!: number;
  public createdAt!: number;
  public updatedAt!: number;
  public revokedAt?: number | null;
  public replacedByTokenHash?: string | null;
  public isRevoked!: number;
}

export function initAdminRefreshToken(sequelize: Sequelize): typeof AdminRefreshToken {
  AdminRefreshToken.init(
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
      tokenHash: {
        type: DataTypes.STRING(128),
        allowNull: false,
        unique: true,
      },
      tokenFamily: {
        type: DataTypes.STRING(64),
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      revokedAt: {
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
    },
    {
      sequelize,
      tableName: 'wd_admin_refresh_tokens',
      timestamps: false,
      underscored: false,
      hooks: {
        beforeValidate: (token: AdminRefreshToken) => {
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
        beforeCreate: (token: AdminRefreshToken) => {
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
        beforeUpdate: (token: AdminRefreshToken) => {
          token.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
      indexes: [
        { fields: ['userId'] },
        { fields: ['tokenHash'], unique: true },
        { fields: ['tokenFamily'] },
        { fields: ['expiresAt'] },
        { fields: ['isRevoked'] },
      ],
    }
  );

  return AdminRefreshToken;
}

export default AdminRefreshToken;
