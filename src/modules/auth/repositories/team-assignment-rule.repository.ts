import { Op, Transaction, literal } from 'sequelize';
import { Team, TeamAssignmentRule, User, sequelize } from '../../../models';
import type { TeamAssignmentRuleAttributes } from '../../../models/schemas/TeamAssignmentRule';

export type TeamAssignmentPermission = keyof Pick<TeamAssignmentRuleAttributes,
  'allowCustomerAssignment' | 'allowScheduleVisit' | 'allowRescheduleVisit'>;

interface EligibleUsersQuery {
  hostId: number;
  actorId: number;
  permission: TeamAssignmentPermission;
  requireFieldAppUser: boolean;
  search?: string;
  targetUserId?: number;
  transaction?: Transaction;
  page?: number;
  limit?: number;
}

export class TeamAssignmentRuleRepository {
  findEligibleUsers(payload: EligibleUsersQuery) {
    const hostId = sequelize.escape(payload.hostId);
    const actorId = sequelize.escape(payload.actorId);
    // EXISTS gives OR eligibility without duplicating users across matching teams.
    const eligibility = literal(`EXISTS (
      SELECT 1 FROM wd_team_members sourceMember
      INNER JOIN wd_users actor
        ON actor.id = sourceMember.userId AND actor.hostId = sourceMember.hostId
        AND actor.accountStatus = 'ACTIVE' AND actor.isDeleted = 0
      INNER JOIN wd_teams sourceTeam
        ON sourceTeam.id = sourceMember.teamId AND sourceTeam.hostId = sourceMember.hostId
        AND sourceTeam.isEnabled = 1 AND sourceTeam.isDeleted = 0
      INNER JOIN wd_team_assignment_rules assignmentRule
        ON assignmentRule.hostId = sourceTeam.hostId AND assignmentRule.sourceTeamId = sourceTeam.id
        AND assignmentRule.isEnabled = 1 AND assignmentRule.isDeleted = 0
        AND assignmentRule.\`${payload.permission}\` = 1
      INNER JOIN wd_teams targetTeam
        ON targetTeam.id = assignmentRule.targetTeamId AND targetTeam.hostId = assignmentRule.hostId
        AND targetTeam.isEnabled = 1 AND targetTeam.isDeleted = 0
      INNER JOIN wd_team_members targetMember
        ON targetMember.teamId = targetTeam.id AND targetMember.hostId = targetTeam.hostId
        AND targetMember.isEnabled = 1
      WHERE sourceMember.hostId = ${hostId} AND sourceMember.userId = ${actorId}
        AND sourceMember.isEnabled = 1
        AND targetMember.userId = \`User\`.\`id\` AND targetMember.hostId = \`User\`.\`hostId\`
    )`);
    return User.findAndCountAll({
      attributes: ['id', 'name'],
      where: {
        hostId: payload.hostId,
        ...(payload.targetUserId === undefined ? {} : { id: payload.targetUserId }),
        [Op.or]: [
          { id: payload.actorId },
          {
            accountStatus: 'ACTIVE', isDeleted: 0,
            ...(payload.requireFieldAppUser ? { isFieldAppUser: 1 } : {}),
            ...(payload.search ? { name: { [Op.like]: `%${payload.search}%` } } : {}),
            [Op.and]: eligibility,
          },
        ],
      },
      order: [['name', 'ASC'], ['id', 'ASC']],
      transaction: payload.transaction,
      ...(payload.limit === undefined ? {} : {
        limit: payload.limit, offset: ((payload.page ?? 1) - 1) * payload.limit,
      }),
    });
  }

  list(hostId: number, sourceTeamId?: number, isEnabled?: number) {
    return TeamAssignmentRule.findAll({
      where: {
        hostId, isDeleted: 0,
        ...(sourceTeamId === undefined ? {} : { sourceTeamId }),
        ...(isEnabled === undefined ? {} : { isEnabled }),
      },
      include: ['sourceTeam', 'targetTeam'].map((as) => ({
        model: Team, as, required: true, where: { hostId },
        attributes: ['id', 'teamName', 'isEnabled', 'isDeleted'],
      })),
      order: [['sourceTeamId', 'ASC'], ['targetTeamId', 'ASC'], ['id', 'ASC']],
    });
  }

  find(hostId: number, ruleId: number, transaction: Transaction) {
    return TeamAssignmentRule.findOne({
      where: { id: ruleId, hostId, isDeleted: 0 },
      transaction, lock: transaction.LOCK.UPDATE,
    });
  }

  findPair(hostId: number, sourceTeamId: number, targetTeamId: number, transaction: Transaction) {
    return TeamAssignmentRule.findOne({
      where: { hostId, sourceTeamId, targetTeamId },
      transaction, lock: transaction.LOCK.UPDATE,
    });
  }

  create(data: Parameters<typeof TeamAssignmentRule.create>[0], transaction: Transaction) {
    return TeamAssignmentRule.create(data, { transaction });
  }

  update(rule: InstanceType<typeof TeamAssignmentRule>, data: Partial<TeamAssignmentRuleAttributes>, transaction: Transaction) {
    return rule.update(data, { transaction });
  }
}

export default new TeamAssignmentRuleRepository();
