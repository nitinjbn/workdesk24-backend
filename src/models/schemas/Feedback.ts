import { Model, DataTypes, Sequelize, Optional } from 'sequelize';
import { FeedbackAttributes } from '../../types';

interface FeedbackCreationAttributes extends Optional<FeedbackAttributes, 'id' | 'localId' | 'relatedId' | 'customerName' | 'customerPhone' | 'rating' | 'category' | 'subject' | 'sentiment' | 'latitude' | 'longitude' | 'syncedAt' | 'createdAt' | 'updatedAt'> {}

class Feedback extends Model<FeedbackAttributes, FeedbackCreationAttributes> implements FeedbackAttributes {
  public id!: number;
  public userId!: number;
  public localId?: string;
  public relatedType!: 'visit' | 'order' | 'product' | 'service' | 'general';
  public relatedId?: number;
  public customerName?: string;
  public customerPhone?: string;
  public rating?: number;
  public category?: string;
  public subject?: string;
  public message!: string;
  public sentiment?: 'positive' | 'neutral' | 'negative';
  public status!: 'pending' | 'reviewed' | 'resolved' | 'archived';
  public feedbackDate!: Date;
  public latitude?: number;
  public longitude?: number;
  public syncedAt?: Date;
  public readonly createdAt!: Date;
  public readonly updatedAt!: Date;

  public static associate(models: any): void {
    Feedback.belongsTo(models.User, {
      foreignKey: 'userId',
      as: 'user',
    });
    Feedback.hasMany(models.Image, {
      foreignKey: 'relatedId',
      constraints: false,
      scope: {
        relatedType: 'feedback',
      },
      as: 'images',
    });
  }
}

export function initFeedback(sequelize: Sequelize): typeof Feedback {
  Feedback.init(
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
      relatedType: {
        type: DataTypes.ENUM('visit', 'order', 'product', 'service', 'general'),
        allowNull: false,
        field: 'related_type',
      },
      relatedId: {
        type: DataTypes.INTEGER.UNSIGNED,
        allowNull: true,
        field: 'related_id',
      },
      customerName: {
        type: DataTypes.STRING(200),
        allowNull: true,
        field: 'customer_name',
      },
      customerPhone: {
        type: DataTypes.STRING(20),
        allowNull: true,
        field: 'customer_phone',
      },
      rating: {
        type: DataTypes.INTEGER,
        allowNull: true,
        validate: {
          min: 1,
          max: 5,
        },
      },
      category: {
        type: DataTypes.STRING(100),
        allowNull: true,
      },
      subject: {
        type: DataTypes.STRING(200),
        allowNull: true,
      },
      message: {
        type: DataTypes.TEXT,
        allowNull: false,
      },
      sentiment: {
        type: DataTypes.ENUM('positive', 'neutral', 'negative'),
        allowNull: true,
      },
      status: {
        type: DataTypes.ENUM('pending', 'reviewed', 'resolved', 'archived'),
        defaultValue: 'pending',
      },
      feedbackDate: {
        type: DataTypes.DATE,
        allowNull: false,
        field: 'feedback_date',
      },
      latitude: {
        type: DataTypes.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: DataTypes.DECIMAL(11, 8),
        allowNull: true,
      },
      syncedAt: {
        type: DataTypes.BIGINT,
        allowNull: true,
        field: 'syncedAt',
      },
    },
    {
      sequelize,
      tableName: 'wd_feedback',
      timestamps: false,
      indexes: [
        { fields: ['user_id'] },
        { fields: ['local_id'] },
        { fields: ['related_type', 'related_id'] },
        { fields: ['feedback_date'] },
        { fields: ['status'] },
      ],
    }
  );

  return Feedback;
}

export default Feedback;
