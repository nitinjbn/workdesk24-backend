import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { InquiryAttributes } from '../../types';

interface InquiryCreationAttributes extends Optional<InquiryAttributes, 'id' | 'phone' | 'ipAddress' | 'userAgent' | 'assignedTo' | 'adminNotes' | 'source' | 'resolvedAt' | 'createdAt' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class Inquiry extends Model<InquiryAttributes, InquiryCreationAttributes> implements InquiryAttributes {
  public id!: number;
  public name!: string;
  public email!: string;
  public phone?: string;
  public subject!: string;
  public message!: string;
  public status!: 'pending' | 'in_progress' | 'resolved' | 'closed';
  public priority!: 'low' | 'medium' | 'high' | 'urgent';
  public ipAddress?: string;
  public userAgent?: string;
  public assignedTo?: number;
  public adminNotes?: string;
  public source?: string;
  public resolvedAt?: number;
  public readonly createdAt!: number;
  public readonly updatedAt!: number;
  public isDeleted!: number;
  public deletedAt!: number | null;

  public static associate(models: any): void {
    Inquiry.belongsTo(models.User, {
      foreignKey: 'assignedTo',
      as: 'assignedAdmin',
    });
  }
}

export function initInquiry(sequelize: Sequelize): typeof Inquiry {
  Inquiry.init(
    {
      id: {
        type: DataTypes.INTEGER,
        primaryKey: true,
        autoIncrement: true,
      },
      name: {
        type: DataTypes.STRING(100),
        allowNull: false,
      },
      email: {
        type: DataTypes.STRING(255),
        allowNull: false,
        validate: {
          isEmail: true,
        },
      },
      phone: {
        type: DataTypes.STRING(20),
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING(200),
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      status: {
        type: DataTypes.ENUM('pending', 'in_progress', 'resolved', 'closed'),
        defaultValue: 'pending',
      },
      priority: {
        type: DataTypes.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium',
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      assignedTo: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
      },
      adminNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      resolvedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
    },
    {
      sequelize,
      tableName: 'wd_inquiries',
      timestamps: false,
      hooks: {
        beforeCreate: async (inquiry: Inquiry) => {
          const now = Math.floor(Date.now() / 1000);
          inquiry.createdAt = now;
          inquiry.updatedAt = now;
          inquiry.isDeleted = 0;
          inquiry.deletedAt = null;
        },
        beforeUpdate: async (inquiry: Inquiry) => {
          inquiry.updatedAt = Math.floor(Date.now() / 1000);
        },
      },
    }
  );

  return Inquiry;
}

export default Inquiry;
