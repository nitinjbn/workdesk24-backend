import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { VisitAttributes } from '../../types';

interface VisitCreationAttributes extends Optional<VisitAttributes, 'id' | 'localId' | 'customerPhone' | 'customerEmail' | 'address' | 'latitude' | 'longitude' | 'purpose' | 'notes' | 'checkOutTime' | 'duration' | 'outcome' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Visit extends Model<VisitAttributes, VisitCreationAttributes> implements VisitAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public customerName!: string;
  public customerPhone?: string;
  public customerEmail?: string;
  public address?: string;
  public latitude?: number;
  public longitude?: number;
  public visitType!: 'meeting' | 'delivery' | 'support' | 'sales' | 'other';
  public purpose?: string;
  public notes?: string;
  public checkInTime!: Date;
  public checkOutTime?: Date;
  public duration?: number;
  public status!: 'scheduled' | 'in_progress' | 'completed' | 'cancelled';
  public outcome?: 'success' | 'failed' | 'rescheduled' | 'not_available';
  public syncedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static associate(models: any): void {
    Visit.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Visit.hasMany(models.Image, {
      foreignKey: 'relatedId',
      constraints: false,
      scope: {
        relatedType: 'visit',
      },
      as: 'images',
    });
  }
}

export function initVisit(sequelize: Sequelize): typeof Visit {
  Visit.init(
    {
      id: {
        type: DataTypes.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: false,
        field: 'user_id',
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
        field: 'local_id',
      },
      customerName: {
        type: DataTypes.STRING(200),
        allowNull: false,
        field: 'customer_name',
      },
      customerPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'customer_phone',
      },
      customerEmail: {
        type: DataTypes.STRING(255),
        allowNull: true,
        field: 'customer_email',
      },
      address: {
        type: DataTypes.TEXT,
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
      visitType: {
        type: DataTypes.ENUM('meeting', 'delivery', 'support', 'sales', 'other'),
        defaultValue: 'meeting',
        field: 'visit_type',
      },
      purpose: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      notes: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      checkInTime: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'check_in_time',
      },
      checkOutTime: {
        type: DataTypes.DATE,
        allowNull: true,
        field: 'check_out_time',
      },
      duration: {
        type: DataTypes.INTEGER,
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
        defaultValue: 'scheduled',
      },
      outcome: {
        type: DataTypes.ENUM('success', 'failed', 'rescheduled', 'not_available'),
        allowNull: true,
      },
      syncedAt: {
        type: DataTypes.DATE,
        allowNull: true,
        },
    },
    {
      sequelize,
      tableName: 'wd_visits',
      indexes: [
        { fields: ['user_id'] },
        { fields: ['local_id'] },
        { fields: ['check_in_time'] },
        { fields: ['status'] },
      ],
    }
  );

  return Visit;
}

export default Visit;
