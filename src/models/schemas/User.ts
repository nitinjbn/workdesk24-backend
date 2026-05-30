import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { BaseModel } from '../../shared/types/base.types';

interface UserAttributes extends BaseModel {
  email: string;
  password: string;
  name?: string;
  role?: 'admin' | 'staff' | 'user';
  isActive?: number;
  lastLoginAt?: number | null;
}

interface UserCreationAttributes extends Optional<UserAttributes, 'id' | 'name' | 'role' | 'isActive' | 'lastLoginAt' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class User extends Model<UserAttributes, UserCreationAttributes> implements UserAttributes {
  public id!: number;
  public email!: string;
  public password!: string;
  public name?: string;
  public role?: 'admin' | 'staff' | 'user';
  public isActive?: number;
  public lastLoginAt?: number | null;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt!: number | null;

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
}

export function initUser(sequelize: Sequelize): typeof User {
  User.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      password: {
        type: DataTypes.STRING(255),
        allowNull: false,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      role: {
        type: DataTypes.ENUM('admin', 'staff', 'user'),
        allowNull: false,
        defaultValue: 'user',
        field: 'role',
      },
      isActive: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
        field: 'isActive',
      },
      lastLoginAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
        field: 'lastLoginAt',
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'createdAt',
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
        field: 'updatedAt',
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
        field: 'isDeleted',
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
        field: 'deletedAt',
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
          if (!user.role) user.role = 'user';
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
