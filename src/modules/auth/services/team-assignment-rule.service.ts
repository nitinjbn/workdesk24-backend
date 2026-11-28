import { Transaction, UniqueConstraintError } from 'sequelize';
import { sequelize } from '../../../models';
import { createConfiguredError } from '../../../shared/utils/error.util';
import ruleRepository, { TeamAssignmentRuleRepository } from '../repositories/team-assignment-rule.repository';
import teamRepository, { TeamRepository } from '../repositories/team.repository';
import type { TeamAssignmentRuleAttributes } from '../../../models/schemas/TeamAssignmentRule';

interface RuleScope { hostId: number; isAdmin: boolean }
interface RuleFields {
  allowCustomerAssignment?: unknown;
  allowScheduleVisit?: unknown;
  allowRescheduleVisit?: unknown;
  isEnabled?: unknown;
}
interface RuleIdentity { sourceTeamId?: unknown; targetTeamId?: unknown }
type RuleChanges = Pick<TeamAssignmentRuleAttributes,
  'allowCustomerAssignment' | 'allowScheduleVisit' | 'allowRescheduleVisit' | 'isEnabled'>;

function ruleError(code: string, message: string, status = 400) {
  return createConfiguredError(code, message, status, code);
}

export class TeamAssignmentRuleService {
  constructor(
    private readonly repository: TeamAssignmentRuleRepository = ruleRepository,
    private readonly teams: Pick<TeamRepository, 'find'> = teamRepository,
    private readonly transactionFactory: () => Promise<Transaction> = () => sequelize.transaction()
  ) {}

  private requireScope(scope: RuleScope): void {
    if (!Number.isSafeInteger(scope.hostId) || scope.hostId <= 0) {
      throw ruleError('AUTH_REQUIRED', 'Valid authenticated host is required', 401);
    }
    if (!scope.isAdmin) throw ruleError('ADMIN_ACCESS_REQUIRED', 'Admin access is required', 403);
  }

  private id(value: unknown, field: string): number {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && (value !== value.trim() || !/^[1-9]\d*$/.test(value))) ||
        !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
      throw ruleError('VALIDATION_ERROR', `${field} must be a positive integer`);
    }
    return Number(value);
  }

  private flag(value: unknown, field: string): number {
    if (value !== 0 && value !== 1) throw ruleError('VALIDATION_ERROR', `${field} must be 0 or 1`);
    return value;
  }

  private fields(payload: RuleFields, creating: boolean): Partial<RuleChanges> {
    const data: Partial<RuleChanges> = {};
    for (const field of ['allowCustomerAssignment', 'allowScheduleVisit', 'allowRescheduleVisit'] as const) {
      if (payload[field] !== undefined) data[field] = this.flag(payload[field], field);
      else if (creating) data[field] = 0;
    }
    if (!creating && payload.isEnabled !== undefined) data.isEnabled = this.flag(payload.isEnabled, 'isEnabled');
    return data;
  }

  async create(payload: RuleScope & RuleFields & RuleIdentity) {
    this.requireScope(payload);
    if (payload.isEnabled !== undefined) {
      throw ruleError('VALIDATION_ERROR', 'New rules are enabled by default; use update to change isEnabled');
    }
    const sourceTeamId = this.id(payload.sourceTeamId, 'sourceTeamId');
    const targetTeamId = this.id(payload.targetTeamId, 'targetTeamId');
    const data = this.fields(payload, true);
    const transaction = await this.transactionFactory();
    try {
      // Lock each team once in ID order, including for reciprocal and same-team rules.
      for (const teamId of [...new Set([sourceTeamId, targetTeamId])].sort((a, b) => a - b)) {
        const team = await this.teams.find(payload.hostId, teamId, transaction);
        if (!team) throw ruleError('TEAM_NOT_FOUND', 'Source or target team not found in this host', 404);
      }
      const existing = await this.repository.findPair(payload.hostId, sourceTeamId, targetTeamId, transaction);
      if (existing && Number(existing.isDeleted) === 0) {
        throw ruleError('TEAM_ASSIGNMENT_RULE_EXISTS', 'A rule for this source and target team already exists', 409);
      }
      const now = Math.floor(Date.now() / 1000);
      const rule = existing
        ? await this.repository.update(existing, { ...data, isEnabled: 1, isDeleted: 0, deletedAt: null, updatedAt: now }, transaction)
        : await this.repository.create({
          hostId: payload.hostId, sourceTeamId, targetTeamId, ...data, isEnabled: 1, createdAt: now,
        }, transaction);
      await transaction.commit();
      return { rule: rule.toJSON() };
    } catch (error) {
      await transaction.rollback();
      if (error instanceof UniqueConstraintError) {
        throw ruleError('TEAM_ASSIGNMENT_RULE_EXISTS', 'A rule for this source and target team already exists', 409);
      }
      throw error;
    }
  }

  async list(payload: RuleScope & { sourceTeamId?: unknown; isEnabled?: unknown }) {
    this.requireScope(payload);
    const sourceTeamId = payload.sourceTeamId === undefined ? undefined : this.id(payload.sourceTeamId, 'sourceTeamId');
    const isEnabled = payload.isEnabled === undefined ? undefined : this.flag(payload.isEnabled, 'isEnabled');
    const rules = await this.repository.list(payload.hostId, sourceTeamId, isEnabled);
    return {
      rules: rules.map((rule) => ({
        ...rule.toJSON(),
        sourceTeamName: rule.sourceTeam.teamName,
        targetTeamName: rule.targetTeam.teamName,
      })),
    };
  }

  private async mutate(payload: RuleScope & { ruleId: unknown }, data: Partial<TeamAssignmentRuleAttributes>) {
    const ruleId = this.id(payload.ruleId, 'ruleId');
    const transaction = await this.transactionFactory();
    try {
      const rule = await this.repository.find(payload.hostId, ruleId, transaction);
      if (!rule) throw ruleError('TEAM_ASSIGNMENT_RULE_NOT_FOUND', 'Team assignment rule not found', 404);
      const updated = await this.repository.update(rule, { ...data, updatedAt: Math.floor(Date.now() / 1000) }, transaction);
      await transaction.commit();
      return { rule: updated.toJSON() };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async update(payload: RuleScope & RuleFields & RuleIdentity & { ruleId: unknown }) {
    this.requireScope(payload);
    if (payload.sourceTeamId !== undefined || payload.targetTeamId !== undefined) {
      throw ruleError('VALIDATION_ERROR', 'sourceTeamId and targetTeamId cannot be updated');
    }
    const data = this.fields(payload, false);
    if (!Object.keys(data).length) throw ruleError('VALIDATION_ERROR', 'At least one rule field is required');
    return this.mutate(payload, data);
  }

  async remove(payload: RuleScope & { ruleId: unknown }) {
    this.requireScope(payload);
    const result = await this.mutate(payload, { isEnabled: 0, isDeleted: 1, deletedAt: Math.floor(Date.now() / 1000) });
    return { ruleId: result.rule.id };
  }
}

export default new TeamAssignmentRuleService();
