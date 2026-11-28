import { Model, ModelStatic, DataTypes, Sequelize, Optional } from 'sequelize';
import type User from './User';

export interface TeamMemberAttributes {
  id: number;
  hostId: number;
  teamId: number;
  userId: number;
  isEnabled: number;
  createdAt: number;
  updatedAt?: number | null;
}

type TeamMemberCreationAttributes = Optional<TeamMemberAttributes, 'id' | 'isEnabled' | 'updatedAt'>;

class TeamMember extends Model<TeamMemberAttributes, TeamMemberCreationAttributes> implements TeamMemberAttributes {
  public id!: number;
  public hostId!: number;
  public teamId!: number;
  public userId!: number;
  public isEnabled!: number;
  public createdAt!: number;
  public updatedAt?: number | null;
  public user?: User;

  public static associate(models: Record<string, ModelStatic<Model>>): void {
    TeamMember.belongsTo(models.Team, { foreignKey: 'teamId', as: 'team' });
    TeamMember.belongsTo(models.User, { foreignKey: 'userId', as: 'user' });
    TeamMember.belongsTo(models.Host, { foreignKey: 'hostId', as: 'host' });
  }
}

export function initTeamMember(sequelize: Sequelize): typeof TeamMember {
  TeamMember.init({
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    hostId: { type: DataTypes.BIGINT, allowNull: false },
    teamId: { type: DataTypes.BIGINT, allowNull: false },
    userId: { type: DataTypes.BIGINT, allowNull: false },
    isEnabled: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
  }, {
    sequelize, tableName: 'wd_team_members', timestamps: false,
    indexes: [
      { fields: ['hostId', 'teamId', 'userId'], unique: true, name: 'uq_team_members_host_team_user' },
      { fields: ['hostId', 'teamId', 'isEnabled'], name: 'idx_team_members_host_team_status' },
      { fields: ['hostId', 'userId', 'isEnabled'], name: 'idx_team_members_host_user_status' },
    ],
  });
  return TeamMember;
}

export default TeamMember;
