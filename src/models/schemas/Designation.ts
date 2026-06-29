import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { DesignationAttributes } from '../../types';

interface DesignationCreationAttributes extends Optional<DesignationAttributes, 'id' | 'name' | 'remarks' | 'isEnabled' | 'isDeleted' | 'createdAt' | 'updatedAt' | 'deletedAt'> {}

class Designation extends Model<DesignationAttributes, DesignationCreationAttributes> implements DesignationAttributes {
  public id!: number;
  public hostId!: number;
  public name!: string;
  public remarks?: string;
  public isEnabled?: number;
  public isDeleted?: number;
  public createdAt?: number;
  public updatedAt?: number;
  public deletedAt?: number | null;

  public static associate(models: any): void {
    Designation.belongsTo(models.Host, {
      foreignKey: 'hostId',
      as: 'host',
    });
  }
}

export function initDesignation(sequelize: Sequelize): typeof Designation {
  Designation.init(
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
      name: {
        type: DataTypes.STRING(50),
        allowNull: false,
      },
      remarks: {
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
      tableName: 'wd_designations',
      timestamps: false,
      indexes: [
        { fields: ['hostId'] },
        { fields: ['name'] },
        { fields: ['isEnabled'] },
        { fields: ['isDeleted'] },
        {
          unique: true,
          fields: ['hostId', 'name']
        },
      ],
    }
  );

  return Designation;
}

export default Designation;