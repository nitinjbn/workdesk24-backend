import { Model, ModelStatic, DataTypes, Sequelize, Optional } from 'sequelize';

export interface TeamAttributes {
  id: number;
  hostId: number;
  teamName: string;
  isEnabled: number;
  isDeleted: number;
  createdAt: number;
  updatedAt?: number | null;
  deletedAt?: number | null;
}

type TeamCreationAttributes = Optional<TeamAttributes,
  'id' | 'isEnabled' | 'isDeleted' | 'updatedAt' | 'deletedAt'>;

class Team extends Model<TeamAttributes, TeamCreationAttributes> implements TeamAttributes {
  public id!: number;
  public hostId!: number;
  public teamName!: string;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt?: number | null;
  public deletedAt?: number | null;

  public static associate(models: Record<string, ModelStatic<Model>>): void {
    Team.belongsTo(models.Host, { foreignKey: 'hostId', as: 'host' });
    Team.hasMany(models.TeamMember, { foreignKey: 'teamId', as: 'members' });
  }
}

export function initTeam(sequelize: Sequelize): typeof Team {
  Team.init({
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    hostId: { type: DataTypes.BIGINT, allowNull: false },
    teamName: { type: DataTypes.STRING(100), allowNull: false },
    isEnabled: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
    deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
  }, {
    sequelize, tableName: 'wd_teams', timestamps: false,
    charset: 'utf8mb4', collate: 'utf8mb4_unicode_ci',
    indexes: [{ fields: ['hostId', 'isDeleted', 'isEnabled'], name: 'idx_teams_host_status' }],
  });
  return Team;
}

export default Team;
