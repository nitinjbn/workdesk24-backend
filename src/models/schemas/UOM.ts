import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { UOMAttributes } from '../../types';

interface UOMCreationAttributes extends Optional<UOMAttributes, 'id' | 'uomCode' | 'uomName' | 'description' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class UOM extends Model<UOMAttributes, UOMCreationAttributes> implements UOMAttributes {
  public id!: number;
  public hostId!: number;
  public uomCode!: string;
  public uomName!: string;
  public description?: string;
  public parentCategoryId?: number;
  public sortOrder?: number;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    UOM.belongsTo(models.User, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initUOM(sequelize: Sequelize): typeof UOM {
  UOM.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      uomCode: {
        type: DataTypes.STRING(20),
        allowNull: false,
      },
      uomName: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      description: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      isEnabled: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_uom',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['uomCode'] },
        { fields: ['uomName'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
      ],
    }
  );

  return UOM;
}

export default UOM;
