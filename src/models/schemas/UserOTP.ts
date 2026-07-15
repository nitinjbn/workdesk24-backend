import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { BaseModel } from '../../shared/types/base.types';

interface UserOTPAttributes extends BaseModel {
  userId: number;
  hostId: number;
  otpHash: string;
  identifierType: string; // Type of identifier (e.g., 'EMAIL', 'MOBILE')
  identifierValue?: string | null;
  expiresAt: number;
  purpose: string; // Purpose of the OTP (e.g., 'LOGIN', 'PASSWORD_RESET', etc.)
  deliveryChannel: string; // Channel through which the OTP was sent (e.g., 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH')
  resendCount: number; // Number of times the OTP has been resent
  status: string; // Status of the OTP (e.g., 'PENDING', 'VERIFIED', 'EXPIRED')
  attemptCount: number; // Number of attempts made to verify the OTP
  maxAttempts: number; // Maximum allowed attempts for OTP verification
  verifiedAt?: number | null; // Timestamp when the OTP was successfully verified
  requestIp?: string | null; // IP address from which the OTP request was made
}

interface UserOTPCreationAttributes extends Optional<UserOTPAttributes, 'id' | 'hostId' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class UserOTP extends Model<UserOTPAttributes, UserOTPCreationAttributes> implements UserOTPAttributes {
  public id!: number;
  public userId!: number;
  public hostId!: number;
  public otpHash!: string;
  public identifierType!: string;
  public identifierValue?: string | null;
  public expiresAt!: number;
  public purpose!: string;
  public deliveryChannel!: string;
  public status!: string;
  public attemptCount!: number;
  public maxAttempts!: number;
  public resendCount!: number;
  public verifiedAt?: number | null;
  public createdAt!: number;
  public updatedAt!: number;
  public requestIp?: string | null;
  // Instance method to compare OTP
  public async compareOtp(candidateOtp: string): Promise<boolean> {
    return bcrypt.compare(candidateOtp, this.otpHash);
  }

  // Override toJSON to exclude OTP hash
  public toJSON(): Partial<UserOTPAttributes> {
    const values: any = { ...this.get() };
    delete values.otpHash;
    return values;
  }
  public static associate(models: any): void {
    UserOTP.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    UserOTP.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
  }
}

export function initUserOTP(sequelize: Sequelize): typeof UserOTP {
  UserOTP.init(
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
      identifierType: { // Type of identifier (e.g., 'EMAIL', 'MOBILE')
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      identifierValue: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      otpHash: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      expiresAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      purpose: { // Purpose of the OTP (e.g., 'LOGIN', 'PASSWORD_RESET', etc.)
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      deliveryChannel: { // Channel through which the OTP was sent (e.g., 'EMAIL', 'SMS', 'WHATSAPP', 'PUSH')
        type: DataTypes.STRING(30),
        allowNull: false,
      },
      resendCount: { // Number of times the OTP has been resent
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      status: { // Status of the OTP (e.g., 'PENDING', 'VERIFIED', 'EXPIRED')
        type: DataTypes.STRING(20),
        allowNull: false,
        defaultValue: 'PENDING',
      },
      attemptCount: { // Number of attempts made to verify the OTP
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 0,
      },
      maxAttempts: { // Maximum allowed attempts for OTP verification
        type: DataTypes.SMALLINT,
        allowNull: false,
        defaultValue: 5,
      },
      verifiedAt: { // Timestamp when the OTP was successfully verified
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      requestIp: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true
      }
    },
    {
      sequelize,
      tableName: 'wd_user_otps',
      timestamps: false,
      underscored: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['userId'] },
        { fields: ['status'] },
        { fields: ['identifierType'] },
        { fields: ['identifierValue'] },
        { fields: ['deliveryChannel'] },
        { fields: ['purpose'] },
        { fields: ['expiresAt'] }
      ],
      hooks: {
        beforeCreate: async (userOtp: UserOTP) => {
          const now = Math.floor(Date.now() / 1000);
          userOtp.createdAt = now;
          userOtp.updatedAt = now;
          if (userOtp.otpHash) {
            userOtp.otpHash = await bcrypt.hash(userOtp.otpHash, 10);
          }
        },
        beforeUpdate: async (userOtp: UserOTP) => {
          userOtp.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
    }
  );

  return UserOTP;
}

export default UserOTP;