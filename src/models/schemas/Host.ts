import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import bcrypt from 'bcryptjs';
import { HostAttributes } from '../../types';

interface HostCreationAttributes extends Optional<HostAttributes, 'id' | 'companyName' | 'companyLogoUrl' | 'websiteUrl' | 'contactPerson' | 'callingCode' | 'mobile' | 'addressLine1' | 'addressLine2' | 'landmark' | 'city' | 'state' | 'postalCode' | 'countryName' | 'countryIsoCode' | 'district' | 'latitude' | 'longitude' | 'gstNumber' | 'panNumber' | 'isActive' | 'lastLoginAt' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class Host extends Model<HostAttributes, HostCreationAttributes> implements HostAttributes {
  public id!: number;
  public companyName!: string;
  public companyLogoUrl?: string;
  public websiteUrl?: string;
  public contactPerson?: string;
  public callingCode?: string;
  public mobile?: string;
  public addressLine1?: string;
  public addressLine2?: string;
  public city?: string;
  public state?: string;
  public postalCode?: string;
  public countryName?: string;
  public countryIsoCode?: string;
  public district?: string;
  public latitude?: number;
  public longitude?: number;
  public gstNumber?: string;
  public panNumber?: string;
  public email!: string;
  public isActive?: number;
  public lastLoginAt?: number | null;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt!: number | null;

  // Override toJSON to exclude password
  public toJSON(): Partial<HostAttributes> {
    const values: any = { ...this.get() };
    delete values.password;
    return values;
  }
}

export function initHost(sequelize: Sequelize): typeof Host {
  Host.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      contactPerson: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      callingCode: {
        type: DataTypes.STRING(6),
        allowNull: true,
      },
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        unique: true,
        validate: { isEmail: true },
      },
      companyName: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      companyLogoUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      websiteUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
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
      postalCode: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      gstNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      panNumber: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      isActive: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
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
      tableName: 'wd_hosts',
      timestamps: false,
      underscored: false
    }
  );

  return Host;
}

export default Host;
