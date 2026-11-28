import { Model, ModelStatic, DataTypes, Sequelize, Optional } from 'sequelize';
import type Team from './Team';

export interface TeamAssignmentRuleAttributes {
  id: number;
  hostId: number;
  sourceTeamId: number;
  targetTeamId: number;
  allowCustomerAssignment: number;
  allowScheduleVisit: number;
  allowRescheduleVisit: number;
  isEnabled: number;
  isDeleted: number;
  createdAt: number;
  updatedAt?: number | null;
  deletedAt?: number | null;
}

type RuleCreationAttributes = Optional<TeamAssignmentRuleAttributes,
  'id' | 'allowCustomerAssignment' | 'allowScheduleVisit' | 'allowRescheduleVisit' |
  'isEnabled' | 'isDeleted' | 'updatedAt' | 'deletedAt'>;

class TeamAssignmentRule extends Model<TeamAssignmentRuleAttributes, RuleCreationAttributes>
  implements TeamAssignmentRuleAttributes {
  public id!: number;
  public hostId!: number;
  public sourceTeamId!: number;
  public targetTeamId!: number;
  public allowCustomerAssignment!: number;
  public allowScheduleVisit!: number;
  public allowRescheduleVisit!: number;
  public isEnabled!: number;
  public isDeleted!: number;
  public createdAt!: number;
  public updatedAt?: number | null;
  public deletedAt?: number | null;
  public sourceTeam!: Team;
  public targetTeam!: Team;

  public static associate(models: Record<string, ModelStatic<Model>>): void {
    TeamAssignmentRule.belongsTo(models.Host, { foreignKey: 'hostId', as: 'host' });
    TeamAssignmentRule.belongsTo(models.Team, { foreignKey: 'sourceTeamId', as: 'sourceTeam' });
    TeamAssignmentRule.belongsTo(models.Team, { foreignKey: 'targetTeamId', as: 'targetTeam' });
  }
}

export function initTeamAssignmentRule(sequelize: Sequelize): typeof TeamAssignmentRule {
  TeamAssignmentRule.init({
    id: { type: DataTypes.BIGINT, autoIncrement: true, primaryKey: true },
    hostId: { type: DataTypes.BIGINT, allowNull: false },
    sourceTeamId: { type: DataTypes.BIGINT, allowNull: false },
    targetTeamId: { type: DataTypes.BIGINT, allowNull: false },
    allowCustomerAssignment: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    allowScheduleVisit: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    allowRescheduleVisit: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    isEnabled: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 1 },
    isDeleted: { type: DataTypes.TINYINT, allowNull: false, defaultValue: 0 },
    createdAt: { type: DataTypes.BIGINT, allowNull: false },
    updatedAt: { type: DataTypes.BIGINT, allowNull: true },
    deletedAt: { type: DataTypes.BIGINT, allowNull: true, defaultValue: null },
  }, {
    sequelize, tableName: 'wd_team_assignment_rules', timestamps: false,
    indexes: [
      { fields: ['hostId', 'sourceTeamId', 'targetTeamId'], unique: true, name: 'uq_team_rules_host_source_target' },
      { fields: ['hostId', 'sourceTeamId', 'isDeleted', 'isEnabled'], name: 'idx_team_rules_host_source_status' },
      { fields: ['hostId', 'targetTeamId', 'isDeleted', 'isEnabled'], name: 'idx_team_rules_host_target_status' },
    ],
  });
  return TeamAssignmentRule;
}

export default TeamAssignmentRule;
