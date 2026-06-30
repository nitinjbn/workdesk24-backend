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
  mobile: string;
  reportingManagerId?: number;
  profileImageUrl?: string;
  joiningDate?: number;
  lastLoginAt?: number;
  isActive?: number;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'hostId' | 'name' | 'roleId' | 'designationId' | 'employeeCode' | 'mobile' | 'reportingManagerId' | 'profileImageUrl' | 'joiningDate' | 'lastLoginAt' | 'isActive' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public hostId!: number;
  public email!: string;
  public roleId!: number;
  public designationId!: number;
  public employeeCode?: string;
  public name?: string;
  public password!: string;
  public mobile!: string;
  public reportingManagerId?: number;
  public profileImageUrl?: string;
  public joiningDate?: number;
  public lastLoginAt?: number | null;
  public isActive?: number;
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
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: false,
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
      lastLoginAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
      isActive: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: false
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
          if (user.isActive === undefined) user.isActive = 1;
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
