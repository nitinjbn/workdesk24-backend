import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { InquiryAttributes } from '../../types';

interface InquiryCreationAttributes extends Optional<
  InquiryAttributes,
  | 'id'
  | 'mobile'
  | 'ipAddress'
  | 'userAgent'
  | 'superAdminNotes'
  | 'source'
  | 'createdAt'
  | 'updatedAt'
  | 'isDeleted'
  | 'deletedAt'
> {}

class Inquiry
  extends Model<InquiryAttributes, InquiryCreationAttributes>
  implements InquiryAttributes
{
  public id!: number;
  public name!: string;
  public email!: string;
  public mobile!: string;
  public subject!: string;
  public message!: string;
  public ipAddress!: string;
  public userAgent!: string;
  public source!: string;
  public superAdminNotes!: string;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt!: number | null;
}

export function initInquiry(sequelize: Sequelize): typeof Inquiry {
  Inquiry.init(
    {
      id: {
        type: DataTypes.BIGINT,
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
      mobile: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      subject: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      ipAddress: {
        type: DataTypes.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: DataTypes.STRING(500),
        allowNull: true,
      },
      superAdminNotes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      source: {
        type: DataTypes.STRING(50),
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
