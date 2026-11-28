import { Op, Transaction } from 'sequelize';
import { Team, TeamMember, User } from '../../../models';
import type { TeamAttributes } from '../../../models/schemas/Team';

export class TeamRepository {
  list(hostId: number, page: number, limit: number, search?: string) {
    return Team.findAndCountAll({
      where: {
        hostId, isDeleted: 0,
        ...(search ? { teamName: { [Op.like]: `%${search}%` } } : {}),
      },
      order: [['teamName', 'ASC'], ['id', 'ASC']],
      limit, offset: (page - 1) * limit,
    });
  }

  find(hostId: number, teamId: number, transaction?: Transaction) {
    return Team.findOne({
      where: { id: teamId, hostId, isDeleted: 0 },
      transaction, lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
  }

  create(data: Parameters<typeof Team.create>[0]) {
    return Team.create(data);
  }

  update(team: InstanceType<typeof Team>, data: Partial<TeamAttributes>, transaction: Transaction) {
    return team.update(data, { transaction });
  }

  listMembers(hostId: number, teamId: number) {
    return TeamMember.findAll({
      where: { hostId, teamId },
      include: [{
        model: User, as: 'user', required: false, where: { hostId },
        attributes: ['id', 'name', 'employeeCode', 'accountStatus', 'isDeleted'],
      }],
      order: [['userId', 'ASC'], ['id', 'ASC']],
    });
  }

  findUser(hostId: number, userId: number, transaction: Transaction) {
    return User.findOne({
      where: { id: userId, hostId },
      attributes: ['id', 'hostId', 'name', 'isDeleted'],
      transaction, lock: transaction.LOCK.UPDATE,
    });
  }

  findMember(hostId: number, teamId: number, userId: number, transaction: Transaction) {
    return TeamMember.findOne({
      where: { hostId, teamId, userId },
      transaction, lock: transaction.LOCK.UPDATE,
    });
  }

  createMember(data: Parameters<typeof TeamMember.create>[0], transaction: Transaction) {
    return TeamMember.create(data, { transaction });
  }

  updateMember(member: InstanceType<typeof TeamMember>, isEnabled: number, transaction: Transaction) {
    return member.update({ isEnabled, updatedAt: Math.floor(Date.now() / 1000) }, { transaction });
  }
}

export default new TeamRepository();
