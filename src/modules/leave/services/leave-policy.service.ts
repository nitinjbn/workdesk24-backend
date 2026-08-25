import { Transaction } from 'sequelize';
import { LeaveType, User, sequelize } from '../../../models';
import leavePolicyRepository from '../repositories/leave-policy.repository';
import leavePolicyRuleRepository from '../repositories/leave-policy-rule.repository';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const BOOLEAN_FLAGS = [0, 1];
const ACCRUAL_TYPES = ['MONTHLY', 'QUARTERLY', 'HALF_YEARLY', 'YEARLY'] as const;
type AccrualType = (typeof ACCRUAL_TYPES)[number];

type PolicyRulePayload = {
  leavePolicyId?: number;
  leaveTypeId: number;
  annualEntitlement: number;
  accrualType: AccrualType;
  allowCarryForward?: number;
  maxCarryForward?: number;
  allowEncashment?: number;
  allowHalfDay?: number;
  minimumNoticeDays?: number;
  maximumAdvanceDays?: number;
  maximumConsecutiveDays?: number;
  allowNegativeBalance?: number;
  requiresApproval?: number;
  isEnabled?: number;
};

export class LeavePolicyService {
  async resolveEmployeeLeavePolicyRule(payload: {
    hostId: number;
    userId: number;
    leaveTypeId: number;
    transaction?: Transaction;
  }): Promise<{
    user: any;
    leavePolicy: any;
    leavePolicyRule: any;
    leaveType: any;
  }> {
    const { hostId, userId, leaveTypeId, transaction } = payload;

    const user = await User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      include: [
        {
          model: (User as any).sequelize.models.LeavePolicy,
          as: 'leavePolicy',
          required: false,
          where: {
            hostId,
            isDeleted: 0,
          },
        },
      ],
      transaction,
    } as any);

    if (!user) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found for this organization', 404);
    }

    const userPlain = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    const leavePolicyId = Number((userPlain as any).leavePolicyId || 0);

    if (!leavePolicyId) {
      throw createConfiguredError(
        'MISSING_EMPLOYEE_LEAVE_POLICY',
        'Employee leavePolicyId is not configured',
        400
      );
    }

    const leavePolicy = (userPlain as any).leavePolicy;
    if (!leavePolicy) {
      throw createConfiguredError(
        'LEAVE_POLICY_NOT_FOUND',
        'Configured leave policy is not available for this organization',
        404
      );
    }

    if (Number((leavePolicy as any).isEnabled) !== 1) {
      throw createConfiguredError(
        'LEAVE_POLICY_DISABLED',
        'Configured leave policy is disabled',
        400
      );
    }

    const leavePolicyRule = await leavePolicyRuleRepository.getRuleByPolicyAndLeaveType(
      hostId,
      leavePolicyId,
      leaveTypeId,
      undefined,
      transaction
    );

    if (!leavePolicyRule) {
      throw createConfiguredError(
        'LEAVE_POLICY_RULE_NOT_FOUND',
        'No active leave policy rule found for this leave type',
        404
      );
    }

    const leaveType = await LeaveType.findOne({
      where: {
        hostId,
        id: leaveTypeId,
        isDeleted: 0,
        isEnabled: 1,
      },
      transaction,
    } as any);

    if (!leaveType) {
      throw createConfiguredError(
        'LEAVE_TYPE_NOT_FOUND',
        'Leave type not found or disabled for this organization',
        404
      );
    }

    return {
      user: userPlain,
      leavePolicy,
      leavePolicyRule,
      leaveType,
    };
  }

  async resolveEmployeeLeaveTypes(payload: {
    hostId: number;
    userId: number;
    transaction?: Transaction;
  }): Promise<{ leavePolicy: any; rules: any[] }> {
    const { hostId, userId, transaction } = payload;

    const user = await User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      include: [
        {
          model: (User as any).sequelize.models.LeavePolicy,
          as: 'leavePolicy',
          required: false,
          where: {
            hostId,
            isDeleted: 0,
          },
        },
      ],
      transaction,
    } as any);

    if (!user) {
      throw createConfiguredError('USER_NOT_FOUND', 'User not found for this organization', 404);
    }

    const userPlain = user && typeof user.toJSON === 'function' ? user.toJSON() : user;
    const leavePolicyId = Number((userPlain as any).leavePolicyId || 0);

    if (!leavePolicyId) {
      throw createConfiguredError(
        'MISSING_EMPLOYEE_LEAVE_POLICY',
        'Employee leavePolicyId is not configured',
        400
      );
    }

    const leavePolicy = (userPlain as any).leavePolicy;
    if (!leavePolicy) {
      throw createConfiguredError(
        'LEAVE_POLICY_NOT_FOUND',
        'Configured leave policy is not available for this organization',
        404
      );
    }

    if (Number((leavePolicy as any).isEnabled) !== 1) {
      throw createConfiguredError(
        'LEAVE_POLICY_DISABLED',
        'Configured leave policy is disabled',
        400
      );
    }

    const rules = await leavePolicyRuleRepository.getActiveRulesWithEnabledLeaveType(
      hostId,
      leavePolicyId,
      transaction
    );

    return {
      leavePolicy,
      rules,
    };
  }

  private isValidDate(value: string): boolean {
    return DATE_REGEX.test(value);
  }

  private isValidFlag(value: unknown): boolean {
    return BOOLEAN_FLAGS.includes(value as 0 | 1);
  }

  private assertValidFlag(value: unknown, fieldName: string): void {
    if (!this.isValidFlag(value)) {
      throw createConfiguredError(
        'INVALID_INPUT',
        `${fieldName} must be 0 or 1`,
        400
      );
    }
  }

  private assertNonNegativeNumber(value: unknown, fieldName: string): void {
    if (typeof value !== 'number' || Number.isNaN(value) || value < 0) {
      throw createConfiguredError(
        'INVALID_INPUT',
        `${fieldName} must be a non-negative number`,
        400
      );
    }
  }

  private assertNonNegativeInteger(value: unknown, fieldName: string): void {
    if (!Number.isInteger(value) || (value as number) < 0) {
      throw createConfiguredError(
        'INVALID_INPUT',
        `${fieldName} must be a non-negative integer`,
        400
      );
    }
  }

  private assertPolicyDateRange(effectiveFrom: string, effectiveTill?: string): void {
    if (!this.isValidDate(effectiveFrom)) {
      throw createConfiguredError('INVALID_DATE_FORMAT', 'effectiveFrom must be in YYYY-MM-DD format', 400);
    }

    if (effectiveTill !== undefined && effectiveTill !== null && effectiveTill !== '') {
      if (!this.isValidDate(effectiveTill)) {
        throw createConfiguredError('INVALID_DATE_FORMAT', 'effectiveTill must be in YYYY-MM-DD format', 400);
      }
      if (effectiveFrom > effectiveTill) {
        throw createConfiguredError('INVALID_DATE_RANGE', 'effectiveFrom must be before or equal to effectiveTill', 400);
      }
    }
  }

  private async assertLeaveTypeBelongsToHost(
    hostId: number,
    leaveTypeId: number,
    requireEnabled: boolean,
    transaction?: Transaction
  ): Promise<void> {
    const where: any = {
      hostId,
      id: leaveTypeId,
      isDeleted: 0,
    };

    if (requireEnabled) {
      where.isEnabled = 1;
    }

    const leaveType = await LeaveType.findOne({ where, transaction } as any);
    if (!leaveType) {
      throw createConfiguredError(
        requireEnabled ? 'LEAVE_TYPE_DISABLED_OR_NOT_FOUND' : 'LEAVE_TYPE_NOT_FOUND',
        requireEnabled
          ? 'Leave type not found or not enabled for this organization'
          : 'Leave type not found for this organization',
        400
      );
    }
  }

  private validateRuleInput(rule: PolicyRulePayload, requireAll: boolean): PolicyRulePayload {
    if (requireAll) {
      if (!rule.leaveTypeId || rule.annualEntitlement === undefined || !rule.accrualType) {
        throw createConfiguredError(
          'INVALID_INPUT',
          'leaveTypeId, annualEntitlement, and accrualType are required for rule creation',
          400
        );
      }
    }

    if (rule.annualEntitlement !== undefined) {
      this.assertNonNegativeNumber(rule.annualEntitlement, 'annualEntitlement');
    }

    if (rule.maxCarryForward !== undefined) {
      this.assertNonNegativeNumber(rule.maxCarryForward, 'maxCarryForward');
    }

    if (rule.accrualType !== undefined && !ACCRUAL_TYPES.includes(rule.accrualType)) {
      throw createConfiguredError(
        'INVALID_ACCRUAL_TYPE',
        `accrualType must be one of: ${ACCRUAL_TYPES.join(', ')}`,
        400
      );
    }

    if (rule.allowCarryForward !== undefined) {
      this.assertValidFlag(rule.allowCarryForward, 'allowCarryForward');
    }
    if (rule.allowEncashment !== undefined) {
      this.assertValidFlag(rule.allowEncashment, 'allowEncashment');
    }
    if (rule.allowHalfDay !== undefined) {
      this.assertValidFlag(rule.allowHalfDay, 'allowHalfDay');
    }
    if (rule.allowNegativeBalance !== undefined) {
      this.assertValidFlag(rule.allowNegativeBalance, 'allowNegativeBalance');
    }
    if (rule.requiresApproval !== undefined) {
      this.assertValidFlag(rule.requiresApproval, 'requiresApproval');
    }
    if (rule.isEnabled !== undefined) {
      this.assertValidFlag(rule.isEnabled, 'isEnabled');
    }

    if (rule.minimumNoticeDays !== undefined) {
      this.assertNonNegativeInteger(rule.minimumNoticeDays, 'minimumNoticeDays');
    }
    if (rule.maximumAdvanceDays !== undefined) {
      this.assertNonNegativeInteger(rule.maximumAdvanceDays, 'maximumAdvanceDays');
    }
    if (rule.maximumConsecutiveDays !== undefined) {
      this.assertNonNegativeInteger(rule.maximumConsecutiveDays, 'maximumConsecutiveDays');
    }

    const allowCarryForward = rule.allowCarryForward !== undefined ? rule.allowCarryForward : 0;
    const maxCarryForward = rule.maxCarryForward !== undefined ? rule.maxCarryForward : 0;

    if (allowCarryForward === 0 && maxCarryForward !== 0) {
      throw createConfiguredError(
        'INVALID_MAX_CARRY_FORWARD',
        'maxCarryForward must be 0 when allowCarryForward is false',
        400
      );
    }

    return {
      leaveTypeId: rule.leaveTypeId,
      annualEntitlement: rule.annualEntitlement,
      accrualType: rule.accrualType,
      allowCarryForward: rule.allowCarryForward !== undefined ? rule.allowCarryForward : 0,
      maxCarryForward: rule.allowCarryForward === 1 ? (rule.maxCarryForward || 0) : 0,
      allowEncashment: rule.allowEncashment !== undefined ? rule.allowEncashment : 0,
      allowHalfDay: rule.allowHalfDay !== undefined ? rule.allowHalfDay : 0,
      minimumNoticeDays: rule.minimumNoticeDays !== undefined ? rule.minimumNoticeDays : 0,
      maximumAdvanceDays: rule.maximumAdvanceDays !== undefined ? rule.maximumAdvanceDays : 0,
      maximumConsecutiveDays:
        rule.maximumConsecutiveDays !== undefined ? rule.maximumConsecutiveDays : 0,
      allowNegativeBalance: rule.allowNegativeBalance !== undefined ? rule.allowNegativeBalance : 0,
      requiresApproval: rule.requiresApproval !== undefined ? rule.requiresApproval : 0,
      isEnabled: rule.isEnabled !== undefined ? rule.isEnabled : 1,
    };
  }

  private async attachRulesToPolicy(hostId: number, policy: any, transaction?: Transaction): Promise<any> {
    const rules = await leavePolicyRuleRepository.getRulesWithLeaveType(
      hostId,
      policy.id,
      transaction
    );
    const policyPlain = policy && typeof policy.toJSON === 'function' ? policy.toJSON() : policy;
    const rulePlain = rules.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      ...policyPlain,
      rules: rulePlain,
    };
  }

  async createLeavePolicy(payload: {
    hostId: number;
    name: string;
    description?: string;
    effectiveFrom: string;
    effectiveTill?: string;
    isDefault?: number;
    isEnabled?: number;
    rules?: PolicyRulePayload[];
  }): Promise<any> {
    const {
      hostId,
      name,
      description,
      effectiveFrom,
      effectiveTill,
      isDefault,
      isEnabled,
      rules,
    } = payload;

    if (!name || !effectiveFrom) {
      throw createConfiguredError('INVALID_INPUT', 'name and effectiveFrom are required', 400);
    }

    const trimmedName = name.trim();
    if (trimmedName.length === 0 || trimmedName.length > 100) {
      throw createConfiguredError('INVALID_POLICY_NAME', 'Policy name must be 1-100 characters', 400);
    }

    this.assertPolicyDateRange(effectiveFrom, effectiveTill);

    if (isDefault !== undefined) {
      this.assertValidFlag(isDefault, 'isDefault');
    }
    if (isEnabled !== undefined) {
      this.assertValidFlag(isEnabled, 'isEnabled');
    }

    const duplicateName = await leavePolicyRepository.getLeavePolicyByName(hostId, trimmedName);
    if (duplicateName) {
      throw createConfiguredError('DUPLICATE_POLICY_NAME', 'A leave policy with this name already exists', 400);
    }

    if (rules !== undefined && !Array.isArray(rules)) {
      throw createConfiguredError('INVALID_INPUT', 'rules must be an array', 400);
    }

    const transaction = await sequelize.transaction();

    try {
      const policy = await leavePolicyRepository.createLeavePolicy(
        hostId,
        {
          name: trimmedName,
          description,
          effectiveFrom,
          effectiveTill,
          isDefault: isDefault || 0,
          isEnabled: isEnabled !== undefined ? isEnabled : 1,
        },
        transaction
      );

      if (isDefault === 1) {
        await leavePolicyRepository.setLeavePolicyAsDefault(hostId, (policy as any).id, transaction);
      }

      if (rules && rules.length > 0) {
        const seenLeaveTypes = new Set<number>();
        const normalizedRules: PolicyRulePayload[] = [];

        for (let i = 0; i < rules.length; i++) {
          const normalized = this.validateRuleInput(rules[i], true);

          if (seenLeaveTypes.has(normalized.leaveTypeId)) {
            throw createConfiguredError(
              'DUPLICATE_POLICY_RULE',
              `Duplicate leaveTypeId found in rules payload at row ${i + 1}`,
              400
            );
          }

          seenLeaveTypes.add(normalized.leaveTypeId);

          await this.assertLeaveTypeBelongsToHost(
            hostId,
            normalized.leaveTypeId,
            true,
            transaction
          );

          normalizedRules.push({
            ...normalized,
            leavePolicyId: (policy as any).id,
          });
        }

        await leavePolicyRuleRepository.createRulesBulk(hostId, normalizedRules as any, transaction);
      }

      await transaction.commit();

      const savedPolicy = await leavePolicyRepository.getLeavePolicyById(hostId, (policy as any).id);
      const enriched = await this.attachRulesToPolicy(hostId, savedPolicy);
      const dateTimeSettings = await getHostDateTimeSettings(hostId);

      return {
        policy: formatDateTimeFieldsBySettings(enriched, dateTimeSettings),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async getLeavePolicies(payload: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = payload;

    const report = await leavePolicyRepository.getLeavePolicies({
      hostId,
      filter,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    return {
      policies: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getLeavePolicyById(payload: {
    hostId: number;
    leavePolicyId: number;
  }): Promise<any> {
    const { hostId, leavePolicyId } = payload;

    const policy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);
    if (!policy) {
      throw createConfiguredError('LEAVE_POLICY_NOT_FOUND', 'Leave policy not found', 404);
    }

    const enriched = await this.attachRulesToPolicy(hostId, policy);
    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      policy: formatDateTimeFieldsBySettings(enriched, dateTimeSettings),
    };
  }

  async updateLeavePolicy(payload: {
    hostId: number;
    leavePolicyId: number;
    name?: string;
    description?: string;
    effectiveFrom?: string;
    effectiveTill?: string | null;
    isDefault?: number;
    isEnabled?: number;
    rules?: PolicyRulePayload[];
  }): Promise<any> {
    const {
      hostId,
      leavePolicyId,
      name,
      description,
      effectiveFrom,
      effectiveTill,
      isDefault,
      isEnabled,
      rules,
    } = payload;

    const existingPolicy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);
    if (!existingPolicy) {
      throw createConfiguredError('LEAVE_POLICY_NOT_FOUND', 'Leave policy not found', 404);
    }

    if (name !== undefined) {
      const trimmedName = name.trim();
      if (trimmedName.length === 0 || trimmedName.length > 100) {
        throw createConfiguredError('INVALID_POLICY_NAME', 'Policy name must be 1-100 characters', 400);
      }

      const duplicateName = await leavePolicyRepository.getLeavePolicyByName(
        hostId,
        trimmedName,
        leavePolicyId
      );
      if (duplicateName) {
        throw createConfiguredError('DUPLICATE_POLICY_NAME', 'A leave policy with this name already exists', 400);
      }
    }

    const finalEffectiveFrom = effectiveFrom !== undefined ? effectiveFrom : (existingPolicy as any).effectiveFrom;
    const finalEffectiveTill =
      effectiveTill !== undefined ? (effectiveTill || undefined) : (existingPolicy as any).effectiveTill;
    this.assertPolicyDateRange(finalEffectiveFrom, finalEffectiveTill);

    if (isDefault !== undefined) {
      this.assertValidFlag(isDefault, 'isDefault');
    }
    if (isEnabled !== undefined) {
      this.assertValidFlag(isEnabled, 'isEnabled');
    }

    if (rules !== undefined && !Array.isArray(rules)) {
      throw createConfiguredError('INVALID_INPUT', 'rules must be an array', 400);
    }

    const transaction = await sequelize.transaction();

    try {
      await leavePolicyRepository.updateLeavePolicy(
        hostId,
        leavePolicyId,
        {
          name,
          description,
          effectiveFrom,
          effectiveTill: effectiveTill === null ? null : effectiveTill,
          isEnabled,
        },
        transaction
      );

      if (isDefault === 1) {
        await leavePolicyRepository.setLeavePolicyAsDefault(hostId, leavePolicyId, transaction);
      }

      if (rules !== undefined) {
        const seenLeaveTypes = new Set<number>();
        const normalizedRules: PolicyRulePayload[] = [];

        for (let i = 0; i < rules.length; i++) {
          const normalized = this.validateRuleInput(rules[i], true);
          if (seenLeaveTypes.has(normalized.leaveTypeId)) {
            throw createConfiguredError(
              'DUPLICATE_POLICY_RULE',
              `Duplicate leaveTypeId found in rules payload at row ${i + 1}`,
              400
            );
          }
          seenLeaveTypes.add(normalized.leaveTypeId);

          await this.assertLeaveTypeBelongsToHost(
            hostId,
            normalized.leaveTypeId,
            true,
            transaction
          );

          normalizedRules.push({
            ...normalized,
            leavePolicyId,
          });
        }

        await leavePolicyRuleRepository.deleteRulesByPolicy(hostId, leavePolicyId, transaction);

        if (normalizedRules.length > 0) {
          await leavePolicyRuleRepository.createRulesBulk(hostId, normalizedRules as any, transaction);
        }
      }

      await transaction.commit();

      const updatedPolicy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);
      const enriched = await this.attachRulesToPolicy(hostId, updatedPolicy);
      const dateTimeSettings = await getHostDateTimeSettings(hostId);

      return {
        policy: formatDateTimeFieldsBySettings(enriched, dateTimeSettings),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async enableDisableLeavePolicy(payload: {
    hostId: number;
    leavePolicyId: number;
    isEnabled: number;
  }): Promise<any> {
    const { hostId, leavePolicyId, isEnabled } = payload;

    this.assertValidFlag(isEnabled, 'isEnabled');

    const policy = await leavePolicyRepository.enableDisableLeavePolicy(
      hostId,
      leavePolicyId,
      isEnabled
    );

    if (!policy) {
      throw createConfiguredError('LEAVE_POLICY_NOT_FOUND', 'Leave policy not found', 404);
    }

    const enriched = await this.attachRulesToPolicy(hostId, policy);
    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      policy: formatDateTimeFieldsBySettings(enriched, dateTimeSettings),
    };
  }

  async deleteLeavePolicy(payload: {
    hostId: number;
    leavePolicyId: number;
  }): Promise<any> {
    const { hostId, leavePolicyId } = payload;

    const policy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);
    if (!policy) {
      throw createConfiguredError('LEAVE_POLICY_NOT_FOUND', 'Leave policy not found', 404);
    }

    const assignmentCount = await leavePolicyRepository.checkDependentAssignments(hostId, leavePolicyId);
    if (assignmentCount > 0) {
      throw createConfiguredError(
        'LEAVE_POLICY_HAS_DEPENDENTS',
        'Cannot delete leave policy as it has assigned users. Consider disabling it instead.',
        400
      );
    }

    const transaction = await sequelize.transaction();

    try {
      await leavePolicyRuleRepository.deleteRulesByPolicy(hostId, leavePolicyId, transaction);
      await leavePolicyRepository.deleteLeavePolicy(hostId, leavePolicyId, transaction);
      await transaction.commit();
      return { success: true };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async setLeavePolicyAsDefault(payload: {
    hostId: number;
    leavePolicyId: number;
  }): Promise<any> {
    const { hostId, leavePolicyId } = payload;

    const policy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);
    if (!policy) {
      throw createConfiguredError('LEAVE_POLICY_NOT_FOUND', 'Leave policy not found', 404);
    }

    const transaction = await sequelize.transaction();

    try {
      await leavePolicyRepository.setLeavePolicyAsDefault(hostId, leavePolicyId, transaction);
      await transaction.commit();

      const defaultPolicy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);
      const enriched = await this.attachRulesToPolicy(hostId, defaultPolicy);
      const dateTimeSettings = await getHostDateTimeSettings(hostId);

      return {
        policy: formatDateTimeFieldsBySettings(enriched, dateTimeSettings),
      };
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async addLeaveTypeRule(payload: {
    hostId: number;
    leavePolicyId: number;
    leaveTypeId: number;
    annualEntitlement: number;
    accrualType: AccrualType;
    allowCarryForward?: number;
    maxCarryForward?: number;
    allowEncashment?: number;
    allowHalfDay?: number;
    minimumNoticeDays?: number;
    maximumAdvanceDays?: number;
    maximumConsecutiveDays?: number;
    allowNegativeBalance?: number;
    requiresApproval?: number;
    isEnabled?: number;
  }): Promise<any> {
    const { hostId, leavePolicyId } = payload;

    const policy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);
    if (!policy) {
      throw createConfiguredError('LEAVE_POLICY_NOT_FOUND', 'Leave policy not found', 404);
    }

    const normalized = this.validateRuleInput(payload as PolicyRulePayload, true);

    await this.assertLeaveTypeBelongsToHost(hostId, normalized.leaveTypeId, true);

    const existingRule = await leavePolicyRuleRepository.getRuleByPolicyAndLeaveType(
      hostId,
      leavePolicyId,
      normalized.leaveTypeId
    );
    if (existingRule) {
      throw createConfiguredError(
        'DUPLICATE_POLICY_RULE',
        'This leave type already has an active rule in this policy',
        400
      );
    }

    const rule = await leavePolicyRuleRepository.createRule(hostId, {
      ...normalized,
      leavePolicyId,
    });

    const rulePlain = rule && typeof rule.toJSON === 'function' ? rule.toJSON() : rule;
    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      rule: formatDateTimeFieldsBySettings(rulePlain, dateTimeSettings),
    };
  }

  async updateLeaveTypeRule(payload: {
    hostId: number;
    ruleId: number;
    leaveTypeId?: number;
    annualEntitlement?: number;
    accrualType?: AccrualType;
    allowCarryForward?: number;
    maxCarryForward?: number;
    allowEncashment?: number;
    allowHalfDay?: number;
    minimumNoticeDays?: number;
    maximumAdvanceDays?: number;
    maximumConsecutiveDays?: number;
    allowNegativeBalance?: number;
    requiresApproval?: number;
    isEnabled?: number;
  }): Promise<any> {
    const { hostId, ruleId } = payload;

    const existingRule = await leavePolicyRuleRepository.getRuleById(hostId, ruleId);
    if (!existingRule) {
      throw createConfiguredError('LEAVE_POLICY_RULE_NOT_FOUND', 'Leave policy rule not found', 404);
    }

    const finalLeaveTypeId =
      payload.leaveTypeId !== undefined ? payload.leaveTypeId : (existingRule as any).leaveTypeId;
    const finalAllowCarryForward =
      payload.allowCarryForward !== undefined
        ? payload.allowCarryForward
        : (existingRule as any).allowCarryForward;
    const finalMaxCarryForward =
      payload.maxCarryForward !== undefined
        ? payload.maxCarryForward
        : Number((existingRule as any).maxCarryForward || 0);

    const mergedPayload: PolicyRulePayload = {
      leaveTypeId: finalLeaveTypeId,
      annualEntitlement:
        payload.annualEntitlement !== undefined
          ? payload.annualEntitlement
          : Number((existingRule as any).annualEntitlement || 0),
      accrualType:
        payload.accrualType !== undefined
          ? payload.accrualType
          : ((existingRule as any).accrualType as AccrualType),
      allowCarryForward: finalAllowCarryForward,
      maxCarryForward: finalMaxCarryForward,
      allowEncashment:
        payload.allowEncashment !== undefined
          ? payload.allowEncashment
          : (existingRule as any).allowEncashment,
      allowHalfDay:
        payload.allowHalfDay !== undefined ? payload.allowHalfDay : (existingRule as any).allowHalfDay,
      minimumNoticeDays:
        payload.minimumNoticeDays !== undefined
          ? payload.minimumNoticeDays
          : (existingRule as any).minimumNoticeDays,
      maximumAdvanceDays:
        payload.maximumAdvanceDays !== undefined
          ? payload.maximumAdvanceDays
          : (existingRule as any).maximumAdvanceDays,
      maximumConsecutiveDays:
        payload.maximumConsecutiveDays !== undefined
          ? payload.maximumConsecutiveDays
          : (existingRule as any).maximumConsecutiveDays,
      allowNegativeBalance:
        payload.allowNegativeBalance !== undefined
          ? payload.allowNegativeBalance
          : (existingRule as any).allowNegativeBalance,
      requiresApproval:
        payload.requiresApproval !== undefined
          ? payload.requiresApproval
          : (existingRule as any).requiresApproval,
      isEnabled: payload.isEnabled !== undefined ? payload.isEnabled : (existingRule as any).isEnabled,
    };

    const normalized = this.validateRuleInput(mergedPayload, true);

    await this.assertLeaveTypeBelongsToHost(hostId, normalized.leaveTypeId, false);

    const duplicateRule = await leavePolicyRuleRepository.getRuleByPolicyAndLeaveType(
      hostId,
      (existingRule as any).leavePolicyId,
      normalized.leaveTypeId,
      ruleId
    );
    if (duplicateRule) {
      throw createConfiguredError(
        'DUPLICATE_POLICY_RULE',
        'This leave type already has an active rule in this policy',
        400
      );
    }

    const updatedRule = await leavePolicyRuleRepository.updateRule(hostId, ruleId, normalized as any);
    if (!updatedRule) {
      throw createConfiguredError('LEAVE_POLICY_RULE_NOT_FOUND', 'Leave policy rule not found', 404);
    }

    const rulePlain = updatedRule && typeof updatedRule.toJSON === 'function' ? updatedRule.toJSON() : updatedRule;
    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      rule: formatDateTimeFieldsBySettings(rulePlain, dateTimeSettings),
    };
  }

  async deleteLeaveTypeRule(payload: {
    hostId: number;
    ruleId: number;
  }): Promise<any> {
    const { hostId, ruleId } = payload;

    const deleted = await leavePolicyRuleRepository.deleteRule(hostId, ruleId);
    if (!deleted) {
      throw createConfiguredError('LEAVE_POLICY_RULE_NOT_FOUND', 'Leave policy rule not found', 404);
    }

    return { success: true };
  }

  async getLeavePolicyRules(payload: {
    hostId: number;
    leavePolicyId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, leavePolicyId, filter, page, limit, sortBy, sortOrder } = payload;

    const policy = await leavePolicyRepository.getLeavePolicyById(hostId, leavePolicyId);
    if (!policy) {
      throw createConfiguredError('LEAVE_POLICY_NOT_FOUND', 'Leave policy not found', 404);
    }

    const report = await leavePolicyRuleRepository.getPolicyRules({
      hostId,
      leavePolicyId,
      filter,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    const plainData = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );
    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      policyId: leavePolicyId,
      rules: formatDateTimeFieldsBySettings(plainData, dateTimeSettings),
      pagination: report.pagination,
    };
  }
}

export default new LeavePolicyService();
