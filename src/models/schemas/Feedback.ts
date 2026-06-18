import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { FeedbackAttributes } from '../../types';

interface FeedbackCreationAttributes extends Optional<FeedbackAttributes, 'id' | 'localId' | 'visitId' | 'latitude' | 'longitude' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Feedback extends Model<FeedbackAttributes, FeedbackCreationAttributes> implements FeedbackAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public visitId?: number;
  public message!: string;
  public feedbackTime!: number;
  public latitude?: number;
  public longitude?: number;
  public syncedAt?: number;
  public createdAt?: number;
  public updatedAt?: number;

  public static associate(models: any): void {
    Feedback.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Feedback.belongsTo(models.Visit, {
      foreignKey: 'visitId',
      as: 'visit',
    });
  }
}

export function initFeedback(sequelize: Sequelize): typeof Feedback {
  Feedback.init(
    {
      id: {
        type: DataTypes.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      localId: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      visitId: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: true,
      },
      mediaUrl: {
        type: DataTypes.STRING(255),
        allowNull: true,
      },
      mediaType: {
        type: DataTypes.STRING(50),
        allowNull: true,
      },
      feedbackTime: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      locationAccuracy: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationAltitude: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationSpeed: {
        type: DataTypes.FLOAT,
        allowNull: true
      },
      locationProvider: {
        type: DataTypes.STRING(100),
        allowNull: true
      },
      batteryPercentage: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      isChargingOnFeedback: {
        type: DataTypes.TINYINT,
        allowNull: true
      },
      createdAt: {
        type: DataTypes.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: DataTypes.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    },
    {
      sequelize,
      tableName: 'wd_feedbacks',
      timestamps: false,
      indexes: [
        { fields: ['userId'] },
        { fields: ['localId'] },
        { fields: ['visitId'] },
        { fields: ['feedbackTime'] }
      ],
    }
  );

  return Feedback;
}

export default Feedback;
