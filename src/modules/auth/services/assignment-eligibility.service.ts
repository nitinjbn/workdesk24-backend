import ruleRepository, { TeamAssignmentRuleRepository, TeamAssignmentPermission } from '../repositories/team-assignment-rule.repository';
import { createConfiguredError } from '../../../shared/utils/error.util';
import type { Transaction } from 'sequelize';

export type AssignmentEligibilityAction = 'CUSTOMER_ASSIGNMENT' | 'SCHEDULE_VISIT' | 'RESCHEDULE_VISIT';

const PERMISSIONS: Record<AssignmentEligibilityAction, TeamAssignmentPermission> = {
  CUSTOMER_ASSIGNMENT: 'allowCustomerAssignment',
  SCHEDULE_VISIT: 'allowScheduleVisit',
  RESCHEDULE_VISIT: 'allowRescheduleVisit',
};

interface EligibilityPayload {
  hostId: number;
  actorId: number;
  action: unknown;
  search?: unknown;
  page?: unknown;
  limit?: unknown;
  targetUserId?: number;
  transaction?: Transaction;
}

function isAction(value: unknown): value is AssignmentEligibilityAction {
  return value === 'CUSTOMER_ASSIGNMENT' || value === 'SCHEDULE_VISIT' || value === 'RESCHEDULE_VISIT';
}

export class AssignmentEligibilityService {
  constructor(private readonly repository: Pick<TeamAssignmentRuleRepository, 'findEligibleUsers'> = ruleRepository) {}

  async isUserEligible(payload: Pick<EligibilityPayload, 'hostId' | 'actorId' | 'action' | 'transaction'> & { targetUserId: number }): Promise<boolean> {
    const result = await this.getEligibleUsers(payload);
    return result.users.length === 1;
  }

  private positiveInteger(value: unknown, field: string): number {
    if ((typeof value !== 'number' && typeof value !== 'string') ||
        (typeof value === 'string' && (value !== value.trim() || !/^[1-9]\d*$/.test(value))) ||
        !Number.isSafeInteger(Number(value)) || Number(value) <= 0) {
      throw createConfiguredError('VALIDATION_ERROR', `${field} must be a positive integer`, 400, 'VALIDATION_ERROR');
    }
    return Number(value);
  }

  async getEligibleUsers(payload: EligibilityPayload) {
    if (!Number.isSafeInteger(payload.hostId) || payload.hostId <= 0 ||
        !Number.isSafeInteger(payload.actorId) || payload.actorId <= 0) {
      throw createConfiguredError('AUTH_REQUIRED', 'Valid authenticated host and user are required', 401, 'AUTH_REQUIRED');
    }
    if (!isAction(payload.action)) {
      throw createConfiguredError('VALIDATION_ERROR', 'action must be CUSTOMER_ASSIGNMENT, SCHEDULE_VISIT or RESCHEDULE_VISIT', 400, 'VALIDATION_ERROR');
    }
    if (payload.search !== undefined &&
        (typeof payload.search !== 'string' || Array.from(payload.search).length > 100)) {
      throw createConfiguredError('VALIDATION_ERROR', 'search must be a string of at most 100 characters', 400, 'VALIDATION_ERROR');
    }
    const search = typeof payload.search === 'string' ? payload.search.trim() : undefined;
    const targetUserId = payload.targetUserId === undefined ? undefined : this.positiveInteger(payload.targetUserId, 'targetUserId');
    const paginated = payload.page !== undefined || payload.limit !== undefined;
    const page = payload.page === undefined ? 1 : this.positiveInteger(payload.page, 'page');
    const limit = payload.limit === undefined ? 10 : this.positiveInteger(payload.limit, 'limit');
    if (limit > 100 || !Number.isSafeInteger((page - 1) * limit)) {
      throw createConfiguredError('VALIDATION_ERROR', 'Pagination is out of range; limit must not exceed 100', 400, 'VALIDATION_ERROR');
    }
    const { rows, count } = await this.repository.findEligibleUsers({
      hostId: payload.hostId,
      actorId: payload.actorId,
      permission: PERMISSIONS[payload.action],
      requireFieldAppUser: payload.action !== 'CUSTOMER_ASSIGNMENT',
      search,
      targetUserId,
      transaction: payload.transaction,
      ...(paginated ? { page, limit } : {}),
    });
    return {
      users: rows.map((user) => ({ userId: user.id, name: user.name })),
      ...(paginated ? { pagination: { total: count, page, limit, totalPages: Math.ceil(count / limit) } } : {}),
    };
  }
}

export default new AssignmentEligibilityService();
