import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { BaseModel } from '../../shared/types/base.types';

interface UserAttributes extends BaseModel {
  email: string;
  hostId: number;
  password: string;
  name?: string;
  roleId: number;
  designationId: number;
  employeeCode?: string;
  enteredMobileNumber?: string;
  callingCode?: string;
  mobile: string;
  mobileVerified: number;
  mobileVerifiedAt?: number | null;
  reportingManagerId?: number;
  profileImageUrl?: string;
  gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  joiningDate?: number;
  lastLoginAt?: number;
  accountStatus: 'ACTIVE' | 'INACTIVE' | 'LOCKED';
  accountStatusUpdatedAt?: number;
  addressLine1?: string;
  addressLine2?: string;
  landmark?: string;
  countryName?: string;
  countryIsoCode?: string;
  state?: string;
  city?: string;
  district?: string;
  pinCode?: string;
  timezone?: string;
  // reportingTime?: string;
  // shiftEndTime?: string;
  // weeklyOffMask?: number;
  // attendanceSelfieRequired?: number;
  // dayoverSelfieRequired?: number;
  // locationTrackingRequired?: number;
  // locationTrackingMinutes?: number;
  employmentStatus?: 'ACTIVE' | 'RESIGNED' | 'TERMINATED' | 'RETIRED' | 'CONTRACT_COMPLETED' | 'TRANSFERRED';
  //employmentStatus: 'ACTIVE' | 'RESIGNED' | 'TERMINATED' | 'RETIRED' | 'CONTRACT_COMPLETED' | 'TRANSFERRED';
  //employmentStatusUpdatedAt?: number;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'hostId' | 'name' | 'roleId' | 'designationId' | 'employeeCode' | 'enteredMobileNumber' | 'callingCode' | 'mobile' | 'mobileVerified' | 'mobileVerifiedAt' | 'reportingManagerId' | 'profileImageUrl' | 'gender' | 'joiningDate' | 'lastLoginAt' | 'accountStatus' | 'accountStatusUpdatedAt' | 'addressLine1' | 'addressLine2' | 'landmark' | 'countryName' | 'countryIsoCode' | 'state' | 'city' | 'district' | 'pinCode' | 'timezone' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public hostId!: number;
  public email!: string;
  public roleId!: number;
  public designationId!: number;
  public employeeCode?: string;
  public name?: string;
  public password!: string;
  public callingCode?: string;
  public mobile!: string;
  public enteredMobileNumber?: string;
  public mobileVerified!: number;
  public mobileVerifiedAt?: number | null;
  public reportingManagerId?: number;
  public profileImageUrl?: string;
  public gender?: "MALE" | "FEMALE" | "OTHER" | "PREFER_NOT_TO_SAY";
  public joiningDate?: number;
  public lastLoginAt?: number | null;
  public accountStatus!: 'ACTIVE' | 'INACTIVE';
  public accountStatusUpdatedAt?: number;
  public addressLine1?: string;
  public addressLine2?: string
  public landmark?: string;
  public countryName?: string;
  public countryIsoCode?: string;
  public state?: string
  public city?: string;
  public district?: string
  public pinCode?: string;
  public timezone?: string;
  //public employmentStatus!: 'ACTIVE' | 'RESIGNED' | 'TERMINATED' | 'RETIRED' | 'CONTRACT_COMPLETED' | 'TRANSFERRED';
  //public accountStatusUpdatedAt?: number;
  //public employmentStatusUpdatedAt?: number;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt?: number | null;

  // Instance method to compare password
  public async comparePassword(candidatePassword: string): Promise<boolean> {
    return bcrypt.compare(candidatePassword, this.password);
  }

  // Override toJSON to exclude password
  public toJSON(): Partial<UserAttributes> {
    const values: any = { ...this.get() };
    delete values.password;
    return values;
  }

  public static associate(models: any): void {
    User.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });

    User.belongsTo(models.Role, {
      foreignKey: 'roleId',
      as: 'role',
    });

    User.belongsTo(models.Designation, {
      foreignKey: 'designationId',
      as: 'designation',
    });

    User.hasMany(models.UserSettings, {
      foreignKey: 'userId',
      as: 'settings',
    });
  }
}

export function initUser(sequelize: Sequelize): typeof User {
  User.init(
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
      designationId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      employeeCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: false,
        validate: { isEmail: true },
      },
      enteredMobileNumber: { // Store the raw mobile number as entered by the user
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      callingCode: {
        type: DataTypes.STRING(6),
        allowNull: true,
      },
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      mobileVerified: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      mobileVerifiedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      reportingManagerId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      profileImageUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      joiningDate: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },      
      // maxWorkingMinutes: {
      //   type: DataTypes.SMALLINT,
      //   allowNull: true,
      // },
      lastLoginAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
      gender: {
        type: DataTypes.ENUM(
          'MALE',
          'FEMALE',
          'OTHER',
          'PREFER_NOT_TO_SAY'
        ),
        allowNull: true,
      },
      accountStatus: {
        type: DataTypes.ENUM(
            'ACTIVE',
            'INACTIVE'
        ),
        allowNull: false,
        defaultValue: 'ACTIVE'
      },
      accountStatusUpdatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
      addressLine1: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      addressLine2: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      landmark: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      countryName: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      countryIsoCode: {
        type: DataTypes.CHAR(2),
        allowNull: true,
      },
      state: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      city: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },      
      district: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      pinCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      timezone: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      // reportingTime: {
      //   type: DataTypes.TIME,
      //   allowNull: true,
      // },
      // shiftEndTime: {
      //   type: DataTypes.TIME,
      //   allowNull: true,
      // },
      // weeklyOffMask: {
      //   type: DataTypes.TINYINT.UNSIGNED,
      //   allowNull: true,
      // },
      // attendanceSelfieRequired: {
      //   type: DataTypes.TINYINT,
      //   allowNull: true,
      // },
      // dayoverSelfieRequired: {
      //   type: DataTypes.TINYINT,
      //   allowNull: true,
      // },
      // locationTrackingRequired: {
      //   type: DataTypes.TINYINT,
      //   allowNull: true,
      // },
      // locationTrackingMinutes: {
      //   type: DataTypes.SMALLINT,
      //   allowNull: true,
      // },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null
      },
    },
    {
      sequelize,
      tableName: 'wd_users',
      timestamps: false,
      underscored: false,
      hooks: {
        beforeCreate: async (user: User) => {
          const now = Math.floor(Date.now() / 1000);
          user.createdAt = now;
          user.updatedAt = now;
          user.isDeleted = 0;
          user.deletedAt = null;
          if (user.accountStatus === undefined) {
            user.accountStatus = 'ACTIVE';
            user.accountStatusUpdatedAt = now;
          }
          if(!user.accountStatusUpdatedAt) {
            user.accountStatusUpdatedAt = now;
          }
          if (user.password) {
            user.password = await bcrypt.hash(user.password, 10);
          }
        },
        beforeUpdate: async (user: User) => {
          user.updatedAt = Math.floor(Date.now() / 1000);
          if (user.changed('password')) {
            user.password = await bcrypt.hash(user.password, 10);
          }
        },
      },
    }
  );

  return User;
}

export default User;
