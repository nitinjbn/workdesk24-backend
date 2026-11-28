import { Transaction, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../../../models';
import { createConfiguredError } from '../../../shared/utils/error.util';
import teamRepository, { TeamRepository } from '../repositories/team.repository';
import type { TeamMemberAttributes } from '../../../models/schemas/TeamMember';

interface TeamScope { hostId: number; isAdmin: boolean }
interface TeamFields { teamName?: unknown; isEnabled?: unknown }
interface MemberPayload extends TeamScope { teamId: unknown; userId: unknown }

function teamError(code: string, message: string, status = 400) {
  return createConfiguredError(code, message, status, code);
}

export class TeamService {
  constructor(
    private readonly repository: TeamRepository = teamRepository,
    private readonly transactionFactory: () => Promise<Transaction> = () => sequelize.transaction()
  ) {}

  private requireScope(scope: TeamScope): void {
    if (!Number.isSafeInteger(scope.hostId) || scope.hostId <= 0) {
      throw teamError('AUTH_REQUIRED', 'Valid authenticated host is required', 401);
    }
    if (!scope.isAdmin) throw teamError('ADMIN_ACCESS_REQUIRED', 'Admin access is required', 403);
  }

  private positiveInteger(value: unknown, field: string): number {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && (value !== value.trim() || !/^[1-9]\d*$/.test(value))) ||
        !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
      throw teamError('VALIDATION_ERROR', `${field} must be a positive integer`);
    }
    return Number(value);
  }

  private enabled(value: unknown): number {
    if (value !== 0 && value !== 1) throw teamError('VALIDATION_ERROR', 'isEnabled must be 0 or 1');
    return value;
  }

  private name(value: unknown): string {
    if (typeof value !== 'string' || !value.trim() || Array.from(value.trim()).length > 100) {
      throw teamError('VALIDATION_ERROR', 'teamName must contain 1-100 characters');
    }
    return value.trim();
  }

  private duplicate(error: unknown, memberLabel?: string): never {
    if (error instanceof UniqueConstraintError) {
      throw teamError(
        memberLabel ? 'TEAM_MEMBER_EXISTS' : 'TEAM_NAME_EXISTS',
        memberLabel ? `${memberLabel} is already a member of this team` : 'A non-deleted team with this name already exists in this host',
        409
      );
    }
    throw error;
  }

  async create(payload: TeamScope & TeamFields) {
    this.requireScope(payload);
    const teamName = this.name(payload.teamName);
    const isEnabled = payload.isEnabled === undefined ? 1 : this.enabled(payload.isEnabled);
    try {
      const team = await this.repository.create({
        hostId: payload.hostId, teamName, isEnabled, createdAt: Math.floor(Date.now() / 1000),
      });
      return { team: team.toJSON() };
    } catch (error) {
      return this.duplicate(error);
    }
  }

  async list(payload: TeamScope & { search?: unknown; page?: unknown; limit?: unknown }) {
    this.requireScope(payload);
    if (payload.search !== undefined &&
        (typeof payload.search !== 'string' || Array.from(payload.search).length > 100)) {
      throw teamError('VALIDATION_ERROR', 'search must be a string of at most 100 characters');
    }
    const search = typeof payload.search === 'string' ? payload.search.trim() : undefined;
    const page = payload.page === undefined ? 1 : this.positiveInteger(payload.page, 'page');
    const limit = payload.limit === undefined ? 10 : this.positiveInteger(payload.limit, 'limit');
    if (limit > 100 || !Number.isSafeInteger((page - 1) * limit)) {
      throw teamError('VALIDATION_ERROR', 'Pagination is out of range; limit must not exceed 100');
    }
    const { rows, count } = await this.repository.list(payload.hostId, page, limit, search);
    return {
      teams: rows.map((team) => team.toJSON()),
      pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) },
    };
  }

  async detail(payload: TeamScope & { teamId: unknown }) {
    this.requireScope(payload);
    const teamId = this.positiveInteger(payload.teamId, 'teamId');
    const team = await this.repository.find(payload.hostId, teamId);
    if (!team) throw teamError('TEAM_NOT_FOUND', 'Team not found', 404);
    const members = await this.repository.listMembers(payload.hostId, teamId);
    return { team: team.toJSON(), members: members.map((member) => member.toJSON()) };
  }

  private async mutateTeam(
    payload: TeamScope & { teamId: unknown },
    data: { teamName?: string; isEnabled?: number; isDeleted?: number; deletedAt?: number }
  ) {
    const teamId = this.positiveInteger(payload.teamId, 'teamId');
    const transaction = await this.transactionFactory();
    try {
      const team = await this.repository.find(payload.hostId, teamId, transaction);
      if (!team) throw teamError('TEAM_NOT_FOUND', 'Team not found', 404);
      const updated = await this.repository.update(team, { ...data, updatedAt: Math.floor(Date.now() / 1000) }, transaction);
      await transaction.commit();
      return { team: updated.toJSON() };
    } catch (error) {
      await transaction.rollback();
      return this.duplicate(error);
    }
  }

  async update(payload: TeamScope & TeamFields & { teamId: unknown }) {
    this.requireScope(payload);
    const data: { teamName?: string; isEnabled?: number } = {};
    if (payload.teamName !== undefined) data.teamName = this.name(payload.teamName);
    if (payload.isEnabled !== undefined) data.isEnabled = this.enabled(payload.isEnabled);
    if (!Object.keys(data).length) throw teamError('VALIDATION_ERROR', 'At least one team field is required');
    return this.mutateTeam(payload, data);
  }

  async remove(payload: TeamScope & { teamId: unknown }) {
    this.requireScope(payload);
    const result = await this.mutateTeam(payload, { isDeleted: 1, deletedAt: Math.floor(Date.now() / 1000) });
    return { teamId: result.team.id };
  }

  async listMembers(payload: TeamScope & { teamId: unknown }) {
    const { members } = await this.detail(payload);
    return { members };
  }

  private async mutateMember(payload: MemberPayload, action: 'add' | 'update' | 'remove', isEnabled: number) {
    const teamId = this.positiveInteger(payload.teamId, 'teamId');
    const isBatch = Array.isArray(payload.userId);
    const values: unknown[] = Array.isArray(payload.userId) ? payload.userId : [payload.userId];
    if (!values.length) throw teamError('VALIDATION_ERROR', 'userId must not be an empty array');
    const userIds = [...new Set(values.map((value) => this.positiveInteger(value, 'userId')))].sort((a, b) => a - b);
    const transaction = await this.transactionFactory();
    let memberLabel = 'User';
    try {
      // Serialize membership changes with team deletion and concurrent additions.
      const team = await this.repository.find(payload.hostId, teamId, transaction);
      if (!team) throw teamError('TEAM_NOT_FOUND', 'Team not found', 404);
      const members: TeamMemberAttributes[] = [];
      // Lock users in ID order to avoid opposite-order batch locks across teams.
      for (const userId of userIds) {
        const user = await this.repository.findUser(payload.hostId, userId, transaction);
        memberLabel = user?.name || 'User';
        if (!user || (action === 'add' && Number(user.isDeleted) !== 0)) {
          throw teamError('TEAM_USER_NOT_FOUND', `${memberLabel} is unavailable in this host`, 404);
        }
        const existing = await this.repository.findMember(payload.hostId, teamId, userId, transaction);
        if (action === 'add' && existing && Number(existing.isEnabled) === 1) {
          throw teamError('TEAM_MEMBER_EXISTS', `${memberLabel} is already a member of this team`, 409);
        }
        if (action !== 'add' && !existing) {
          throw teamError('TEAM_MEMBER_NOT_FOUND', `Team membership not found for ${memberLabel}`, 404);
        }
        const member = existing
          ? await this.repository.updateMember(existing, isEnabled, transaction)
          : await this.repository.createMember({
            hostId: payload.hostId, teamId, userId, isEnabled: 1, createdAt: Math.floor(Date.now() / 1000),
          }, transaction);
        members.push(member.toJSON());
      }
      await transaction.commit();
      return isBatch ? { members } : { member: members[0] };
    } catch (error) {
      await transaction.rollback();
      return this.duplicate(error, memberLabel);
    }
  }

  async addMember(payload: MemberPayload) {
    this.requireScope(payload);
    return this.mutateMember(payload, 'add', 1);
  }

  async updateMember(payload: MemberPayload & { isEnabled: unknown }) {
    this.requireScope(payload);
    return this.mutateMember(payload, 'update', this.enabled(payload.isEnabled));
  }

  async removeMember(payload: MemberPayload) {
    this.requireScope(payload);
    return this.mutateMember(payload, 'remove', 0);
  }
}

export default new TeamService();
