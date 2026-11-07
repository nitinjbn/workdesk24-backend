import { DataTypes, Model, Optional, Sequelize } from 'sequelize';

interface AdminHostSwitchAuditAttributes {
  id: number;
  switchSessionId: string;
  originalUserId: number;
  originalHostId: number;
  previousHostId?: number | null;
  newHostId?: number | null;
  eventType: 'SWITCH' | 'SESSION_TERMINATED';
  contextVersion: number;
  requestIp?: string | null;
  userAgent?: string | null;
  createdAt: number;
  updatedAt: number;
  isDeleted: number;
  deletedAt?: number | null;
}

interface AdminHostSwitchAuditCreationAttributes
  extends Optional<AdminHostSwitchAuditAttributes, 'id' | 'previousHostId' | 'newHostId' | 'requestIp' | 'userAgent' | 'updatedAt' | 'isDeleted' | 'deletedAt'> {}

class AdminHostSwitchAudit
  extends Model<AdminHostSwitchAuditAttributes, AdminHostSwitchAuditCreationAttributes>
  implements AdminHostSwitchAuditAttributes
{
  public id!: number;
  public switchSessionId!: string;
  public originalUserId!: number;
  public originalHostId!: number;
  public previousHostId?: number | null;
  public newHostId?: number | null;
  public eventType!: 'SWITCH' | 'SESSION_TERMINATED';
  public contextVersion!: number;
  public requestIp?: string | null;
  public userAgent?: string | null;
  public createdAt!: number;
  public updatedAt!: number;
  public isDeleted!: number;
  public deletedAt?: number | null;
}

export function initAdminHostSwitchAudit(sequelize: Sequelize): typeof AdminHostSwitchAudit {
  AdminHostSwitchAudit.init(
    {
      id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
      switchSessionId: { type: DataTypes.STRING(36), allowNull: false },
      originalUserId: { type: DataTypes.BIGINT, allowNull: false },
      originalHostId: { type: DataTypes.BIGINT, allowNull: false },
      previousHostId: { type: DataTypes.BIGINT, allowNull: true },
      newHostId: { type: DataTypes.BIGINT, allowNull: true },
      eventType: { type: DataTypes.ENUM('SWITCH', 'SESSION_TERMINATED'), allowNull: false },
      contextVersion: { type: DataTypes.INTEGER, allowNull: false },
      requestIp: { type: DataTypes.STRING(45), allowNull: true },
      userAgent: { type: DataTypes.STRING(512), allowNull: true },
      createdAt: { type: DataTypes.BIGINT, allowNull: false },
      updatedAt: { type: DataTypes.BIGINT, allowNull: false },
      isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
      deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
    },
    {
      sequelize,
      tableName: 'wd_admin_host_switch_audits',
      timestamps: false,
      underscored: false,
      hooks: {
        beforeBulkUpdate: () => {
          throw new Error('Host-switch audit records are append-only');
        },
        beforeBulkDestroy: () => {
          throw new Error('Host-switch audit records are append-only');
        },
        beforeUpdate: () => {
          throw new Error('Host-switch audit records are append-only');
        },
        beforeDestroy: () => {
          throw new Error('Host-switch audit records are append-only');
        },
      },
      indexes: [
        { fields: ['switchSessionId', 'createdAt'] },
        { fields: ['originalUserId', 'createdAt'] },
        { fields: ['newHostId', 'createdAt'] },
      ],
    }
  );

  return AdminHostSwitchAudit;
}

export default AdminHostSwitchAudit;