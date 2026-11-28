import moment from 'moment-timezone';
import { createHash } from 'crypto';
import { Op, Transaction, UniqueConstraintError } from 'sequelize';
import db from '../../../models';
import visitPlanRepository from '../repositories/visit-plan.repository';
import { getHostDateTimeSettings, type HostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { FIELD_FORMAT_CONFIG, formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import type { AuthRequest } from '../../../shared/types/auth.types';
import type { VisitPlanStatus } from '../../../models/schemas/VisitPlan';
import customerService from '../../master/services/customer.service';
import assignmentEligibilityService, { type AssignmentEligibilityAction } from '../../auth/services/assignment-eligibility.service';

interface AuthUser {
  id: number;
  hostId: number;
  isAdminUser?: number;
  isFieldAppUser?: number;
  isSuperAdmin?: number;
}

interface CustomerIdentifiers {
  customerId?: unknown;
  customerLocalId?: unknown;
}

const VISIT_DATE_FORMAT_CONFIG: Record<string, 'date' | 'datetime'> = {
  ...FIELD_FORMAT_CONFIG,
  scheduledDate: 'date',
  oldScheduledDate: 'date',
  newScheduledDate: 'date',
};

export class VisitPlanService {
  private requireAppAccess(user: AuthUser): void {
    void user;
    return;
  }

  private toPositiveInteger(value: unknown): number | null {
    const parsed = Number(value);
    return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
  }

  private validateTime(value: unknown): string | null {
    if (value === undefined || value === null || value === '') return null;
    if (typeof value !== 'string' || !/^([01]\d|2[0-3]):[0-5]\d$/.test(value)) {
      throw createConfiguredError('VALIDATION_ERROR', 'scheduledTime must be in HH:mm format', 400);
    }
    return value;
  }

  private async visitDateTimeSettings(hostId: number): Promise<HostDateTimeSettings> {
    const settings = await getHostDateTimeSettings(hostId);
    const timeZone = moment.tz.zone(settings.timeZone) ? settings.timeZone : 'UTC';
    return { ...settings, timeZone };
  }

  private formatVisitResponse<T>(data: T, settings: HostDateTimeSettings): T {
    return formatDateTimeFieldsBySettings(data, settings, VISIT_DATE_FORMAT_CONFIG);
  }

  private async hostToday(hostId: number): Promise<{ timeZone: string; today: number; dateTimeSettings: HostDateTimeSettings }> {
    const dateTimeSettings = await this.visitDateTimeSettings(hostId);
    const { timeZone } = dateTimeSettings;
    return {
      timeZone,
      today: moment.tz(timeZone).startOf('day').unix(),
      dateTimeSettings,
    };
  }

  private parseScheduledDate(dateValue: unknown, timeZone: string): number {
    if (typeof dateValue !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(dateValue)) {
      throw createConfiguredError('VALIDATION_ERROR', 'scheduledDate must be YYYY-MM-DD', 400);
    }
    const parsed = moment.tz(dateValue, 'YYYY-MM-DD', true, timeZone);
    if (!parsed.isValid()) {
      throw createConfiguredError('VALIDATION_ERROR', 'Invalid scheduledDate', 400);
    }
    return parsed.startOf('day').unix();
  }

  isOverdue(
    visit: { scheduledDate: number; scheduledTime?: string | null; status: VisitPlanStatus },
    nowUnix: number,
    timeZone: string
  ): boolean {
    if (visit.status !== 'SCHEDULED' && visit.status !== 'IN_PROGRESS') return false;
    if (!visit.scheduledTime) {
      const dayEnd = moment
        .tz(visit.scheduledDate * 1000, timeZone)
        .add(1, 'day')
        .startOf('day')
        .unix();
      return nowUnix >= dayEnd;
    }
    const deadline = moment.tz(
      `${moment.tz(visit.scheduledDate * 1000, timeZone).format('YYYY-MM-DD')} ${visit.scheduledTime}`,
      'YYYY-MM-DD HH:mm',
      true,
      timeZone
    ).unix();
    return nowUnix > deadline;
  }

  private isAdmin(user: AuthUser): boolean {
    return user.isAdminUser === 1 || user.isSuperAdmin === 1;
  }

  private isFieldOfficer(user: AuthUser): boolean {
    return user.isFieldAppUser === 1 && !this.isAdmin(user);
  }

  private async ensureAssignmentEligible(
    user: AuthUser,
    assignedUserId: number,
    action: AssignmentEligibilityAction,
    transaction: Transaction
  ): Promise<void> {
    if (this.isAdmin(user)) return;
    if (!await assignmentEligibilityService.isUserEligible({
      hostId: user.hostId, actorId: user.id, targetUserId: assignedUserId, action, transaction,
    })) {
      throw createConfiguredError(
        'FORBIDDEN', `Assigned user is not eligible for ${action}`, 403, 'TEAM_ASSIGNMENT_FORBIDDEN'
      );
    }
  }

  private async assignVisitUserToCustomer(user: AuthUser, customerId: number, assignedUserId: number, transaction: Transaction): Promise<void> {
    await customerService.assignUserIfCustomerRestricted(
      user.hostId, customerId, assignedUserId, transaction,
      () => this.ensureAssignmentEligible(user, assignedUserId, 'CUSTOMER_ASSIGNMENT', transaction)
    );
  }

  private async ensureCustomerAccessible(
    user: AuthUser,
    customerId: number,
    transaction?: Transaction,
    lockAssignments = false
  ): Promise<void> {
    const assignments = await visitPlanRepository.findCustomerAssignments(
      user.hostId,
      customerId,
      transaction,
      lockAssignments
    );
    if (
      assignments.length > 0 &&
      !assignments.some((assignment) => Number(assignment.userId) === user.id)
    ) {
      if (this.isFieldOfficer(user)) {
        throw createConfiguredError(
          'FORBIDDEN',
          'Field officer is not assigned to this customer',
          403,
          'CUSTOMER_NOT_ASSIGNED_TO_FIELD_OFFICER'
        );
      }
      throw createConfiguredError('FORBIDDEN', 'Customer is not accessible to this app user', 403);
    }
  }

  private canAccessVisit(user: AuthUser, visit: { assignedUserId: number | string }): boolean {
    if (this.isAdmin(user)) return true;
    if (this.isFieldOfficer(user)) return user.id === this.toPositiveInteger(visit.assignedUserId);
    return true;
  }

  private async resolveCustomer(hostId: number, identifiers: CustomerIdentifiers, transaction?: Transaction) {
    const suppliedId = this.toPositiveInteger(identifiers.customerId);
    if (suppliedId) {
      const customer = await visitPlanRepository.resolveCustomer(hostId, suppliedId, transaction);
      if (customer) return customer;
    }

    if (
      identifiers.customerLocalId !== undefined &&
      identifiers.customerLocalId !== null &&
      typeof identifiers.customerLocalId !== 'string'
    ) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'customerLocalId must be a string',
        400
      );
    }
    const localValue =
      typeof identifiers.customerLocalId === 'string' && identifiers.customerLocalId.trim()
        ? identifiers.customerLocalId.trim()
        : null;
    if (localValue) {
      const customers = await visitPlanRepository.findCustomersByLocalId(hostId, localValue, transaction);
      if (customers.length > 1) {
        throw createConfiguredError(
          'VISIT_CUSTOMER_LOCAL_ID_AMBIGUOUS',
          'customerLocalId matches multiple customers',
          409,
          'CUSTOMER_LOCAL_ID_AMBIGUOUS'
        );
      }
      if (customers.length === 1) return customers[0];
    } else if (!suppliedId) {
      const invalidId = identifiers.customerId !== undefined && identifiers.customerId !== null;
      throw createConfiguredError(
        'VALIDATION_ERROR',
        invalidId ? 'customerId must be a positive integer' : 'customerId or customerLocalId is required',
        400
      );
    }
    throw createConfiguredError(
      'VISIT_CUSTOMER_NOT_FOUND',
      'Customer was not found',
      404,
      'CUSTOMER_NOT_FOUND'
    );
  }

  private async validateAssignedUser(
    hostId: number,
    assignedUserId: unknown,
    fallbackUser: AuthUser,
    customerId: number,
    transaction?: Transaction
  ): Promise<number> {
    let resolvedId = this.toPositiveInteger(assignedUserId);
    if (!resolvedId) {
      if (assignedUserId !== undefined && assignedUserId !== null) {
        throw createConfiguredError('VALIDATION_ERROR', 'assignedUserId must be a positive integer', 400);
      }
      if (this.isFieldOfficer(fallbackUser)) {
        resolvedId = fallbackUser.id;
      } else {
        const assignments = await visitPlanRepository.findCustomerAssignments(
          hostId,
          customerId,
          transaction,
          true
        );
        if (assignments.length === 1) resolvedId = Number(assignments[0].userId);
      }
    }
    if (!resolvedId) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'assignedUserId is required',
        400,
        'ASSIGNED_USER_REQUIRED'
      );
    }
    const user = await visitPlanRepository.findUser(hostId, resolvedId, transaction, resolvedId !== fallbackUser.id);
    if (!user) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'Assigned user was not found or is inactive',
        400,
        'ASSIGNED_USER_NOT_FOUND'
      );
    }
    if (
      Number(user.hostId) !== hostId ||
      Number(user.isDeleted) !== 0 ||
      user.accountStatus !== 'ACTIVE' ||
      (resolvedId !== fallbackUser.id && Number(user.isFieldAppUser) !== 1)
    ) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'Assigned employee is inactive, deleted, disabled, or cannot use the app',
        400,
        'ASSIGNED_USER_INELIGIBLE'
      );
    }
    await this.ensureCustomerAccessible(fallbackUser, customerId, transaction, true);
    return resolvedId;
  }

  private scheduleRequestHash(body: Record<string, unknown>): string {
    const fields = ['customerId', 'customerLocalId', 'scheduledDate', 'scheduledTime', 'assignedUserId', 'remarks'];
    const payload = fields.map((field) => body[field] === undefined ? null : body[field]);
    return createHash('sha256').update(JSON.stringify(payload)).digest('hex');
  }

  private assertMatchingScheduleRequest(
    plan: { createdBy: number; idempotencyRequestHash?: string | null; isDeleted: number },
    user: AuthUser,
    requestHash: string
  ): void {
    if (Number(plan.createdBy) !== user.id || !plan.idempotencyRequestHash ||
        plan.idempotencyRequestHash !== requestHash || Number(plan.isDeleted) !== 0) {
      throw createConfiguredError('CONFLICT', 'Schedule request cannot be retried with this key', 409, 'SCHEDULE_IDEMPOTENCY_CONFLICT');
    }
  }

  async schedule(user: AuthUser, body: Record<string, unknown>) {
    this.requireAppAccess(user);
    const hostId = user.hostId;
    const idempotencyKey =
      typeof body.idempotencyKey === 'string' && body.idempotencyKey.trim()
        ? body.idempotencyKey.trim().slice(0, 100)
        : null;
    const requestHash = idempotencyKey ? this.scheduleRequestHash(body) : null;

    try {
      return await db.sequelize.transaction(async (transaction: Transaction) => {
        if (idempotencyKey) {
          const existing = await visitPlanRepository.findIdempotent(
            hostId,
            idempotencyKey,
            transaction
          );
          if (existing) {
            this.assertMatchingScheduleRequest(existing, user, requestHash!);
            await customerService.lockCustomerForAssignment(hostId, existing.customerId, transaction);
            await this.ensureCustomerAccessible(user, existing.customerId, transaction, true);
            return this.formatVisitResponse(existing.toJSON(), await this.visitDateTimeSettings(hostId));
          }
        }
        const customer = await this.resolveCustomer(hostId, body, transaction);
        await customerService.lockCustomerForAssignment(hostId, customer.id, transaction);
        const settings = await this.visitDateTimeSettings(hostId);
        const { timeZone } = settings;
        const scheduledDate = this.parseScheduledDate(body.scheduledDate, timeZone);
        const scheduledTime = this.validateTime(body.scheduledTime);
        const assignedUserId = await this.validateAssignedUser(
          hostId,
          body.assignedUserId,
          user,
          customer.id,
          transaction
        );
        await this.ensureAssignmentEligible(user, assignedUserId, 'SCHEDULE_VISIT', transaction);
        const duplicate = await visitPlanRepository.findDuplicate(
          hostId,
          customer.id,
          scheduledDate,
          undefined,
          transaction
        );
        await this.assignVisitUserToCustomer(user, customer.id, assignedUserId, transaction);
        const now = Math.floor(Date.now() / 1000);
        const plan = await visitPlanRepository.create(
          {
            hostId,
            customerId: customer.id,
            customerLocalId: customer.localId ? String(customer.localId) : null,
            assignedUserId,
            scheduledDate,
            scheduledTime,
            remarks: typeof body.remarks === 'string' ? body.remarks : null,
            status: 'SCHEDULED',
            idempotencyKey,
            idempotencyRequestHash: requestHash,
            createdBy: user.id,
            createdAt: now,
            updatedAt: now,
          },
          transaction
        );
        await visitPlanRepository.historyCreate(
          {
            hostId,
            visitId: plan.id,
            customerId: customer.id,
            eventType: 'VISIT_SCHEDULED',
            newScheduledDate: scheduledDate,
            newScheduledTime: scheduledTime,
            remarks: typeof body.remarks === 'string' ? body.remarks : null,
            performedBy: user.id,
            eventAt: now,
            createdAt: now,
            updatedAt: now,
          },
          transaction
        );
        const data = plan.toJSON();
        return this.formatVisitResponse({ ...data, duplicateActiveVisit: !!duplicate }, settings);
      });
    } catch (error) {
      if (idempotencyKey && error instanceof UniqueConstraintError) {
        const existing = await visitPlanRepository.findIdempotent(hostId, idempotencyKey);
        if (existing) {
          this.assertMatchingScheduleRequest(existing, user, requestHash!);
          await this.ensureCustomerAccessible(user, existing.customerId);
          return this.formatVisitResponse(existing.toJSON(), await this.visitDateTimeSettings(hostId));
        }
      }
      throw error;
    }
  }

  async reschedule(user: AuthUser, body: Record<string, unknown>) {
    this.requireAppAccess(user);
    const hostId = user.hostId;
    const visitId = this.toPositiveInteger(body.visitId);
    if (!visitId) throw createConfiguredError('VALIDATION_ERROR', 'visitId is required', 400);
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
    if (!remarks) throw createConfiguredError('VALIDATION_ERROR', 'remarks are required', 400);
    let keyHash: string | null = null;
    let requestHash: string | null = null;
    if (body.idempotencyKey !== undefined && body.idempotencyKey !== null) {
      if (typeof body.idempotencyKey !== 'string' ||
          !body.idempotencyKey.trim() || body.idempotencyKey.trim().length > 100) {
        throw createConfiguredError('VALIDATION_ERROR', 'Invalid idempotency key', 400);
      }
      const assigned = body.assignedUserId === undefined ? 'unchanged' :
        body.assignedUserId === null ? 'default' : this.toPositiveInteger(body.assignedUserId);
      if (assigned === null) {
        throw createConfiguredError('VALIDATION_ERROR', 'assignedUserId must be a positive integer', 400);
      }
      this.parseScheduledDate(body.scheduledDate, 'UTC');
      const time = this.validateTime(body.scheduledTime);
      keyHash = createHash('sha256').update(body.idempotencyKey.trim()).digest('hex');
      requestHash = createHash('sha256').update(JSON.stringify([
        visitId, body.scheduledDate, time, assigned, remarks,
      ])).digest('hex');
    }

    const replay = async (
      operation: { visitId: number; requestHash: string; result: string },
      transaction?: Transaction
    ) => {
      if (Number(operation.visitId) !== visitId || operation.requestHash !== requestHash) {
        throw createConfiguredError('CONFLICT', 'Reschedule key does not match request', 409, 'RESCHEDULE_IDEMPOTENCY_CONFLICT');
      }
      const plan = await visitPlanRepository.findById(hostId, visitId, transaction, !!transaction);
      if (!plan) throw createConfiguredError('NOT_FOUND', 'Visit plan not found', 404);
      if (transaction) {
        await customerService.lockCustomerForAssignment(hostId, plan.customerId, transaction);
      }
      await this.ensureCustomerAccessible(user, plan.customerId, transaction, !!transaction);
      return JSON.parse(operation.result);
    };

    if (keyHash) {
      const existing = await visitPlanRepository.findRescheduleOperation(hostId, user.id, keyHash);
      if (existing) return replay(existing);
    }

    try {
      return await db.sequelize.transaction(async (transaction: Transaction) => {
      const plan = await visitPlanRepository.findById(hostId, visitId, transaction, true);
      if (!plan) throw createConfiguredError('NOT_FOUND', 'Visit plan not found', 404);
      if (keyHash) {
        const existing = await visitPlanRepository.findRescheduleOperation(hostId, user.id, keyHash, transaction);
        if (existing) return replay(existing, transaction);
      }
      await customerService.lockCustomerForAssignment(hostId, plan.customerId, transaction);
      await this.ensureCustomerAccessible(user, plan.customerId, transaction, true);
      if (plan.status !== 'SCHEDULED') {
        throw createConfiguredError('VISIT_INVALID_TRANSITION', 'Only scheduled visits can be rescheduled', 409);
      }
      const settings = await this.visitDateTimeSettings(hostId);
      const { timeZone } = settings;
      const scheduledDate = this.parseScheduledDate(body.scheduledDate, timeZone);
      const scheduledTime = this.validateTime(body.scheduledTime);
      const assignedUserId =
        body.assignedUserId === undefined
          ? plan.assignedUserId
          : await this.validateAssignedUser(hostId, body.assignedUserId, user, plan.customerId, transaction);
      await this.ensureAssignmentEligible(user, Number(assignedUserId), 'RESCHEDULE_VISIT', transaction);
      if (Number(assignedUserId) !== Number(plan.assignedUserId)) {
        await this.assignVisitUserToCustomer(user, plan.customerId, assignedUserId, transaction);
      }
      const oldScheduledDate = plan.scheduledDate;
      const oldScheduledTime = plan.scheduledTime;
      const now = Math.floor(Date.now() / 1000);
      await visitPlanRepository.updateVisit(
        plan,
        {
          scheduledDate,
          scheduledTime,
          assignedUserId,
          remarks,
          rescheduleRevision: Number(plan.rescheduleRevision ?? 0) + 1,
          updatedAt: now,
        },
        transaction
      );
      await visitPlanRepository.historyCreate(
        {
          hostId,
          visitId: plan.id,
          customerId: plan.customerId,
          eventType: 'VISIT_RESCHEDULED',
          oldScheduledDate,
          newScheduledDate: scheduledDate,
          oldScheduledTime,
          newScheduledTime: scheduledTime,
          remarks,
          performedBy: user.id,
          eventAt: now,
          createdAt: now,
          updatedAt: now,
        },
        transaction
      );
      const result = this.formatVisitResponse(plan.toJSON(), settings);
      if (keyHash && requestHash) {
        await visitPlanRepository.createRescheduleOperation({
          hostId, userId: user.id, visitId, keyHash, requestHash,
          result: JSON.stringify(result), createdAt: now,
        }, transaction);
      }
      return result;
      });
    } catch (error) {
      if (keyHash && error instanceof UniqueConstraintError) {
        const existing = await visitPlanRepository.findRescheduleOperation(hostId, user.id, keyHash);
        if (existing) return replay(existing);
      }
      throw error;
    }
  }

  async reschedulePreparation(user: AuthUser, body: Record<string, unknown>) {
    this.requireAppAccess(user);
    const visitId = this.toPositiveInteger(body.visitId);
    if (!visitId) throw createConfiguredError('VALIDATION_ERROR', 'visitId is required', 400);
    const plan = await visitPlanRepository.findById(user.hostId, visitId);
    if (!plan) throw createConfiguredError('NOT_FOUND', 'Visit plan not found', 404);
    await this.ensureCustomerAccessible(user, plan.customerId);
    return {
      contractVersion: 2,
      hostId: user.hostId,
      userId: user.id,
      visitId,
      revision: Number(plan.rescheduleRevision),
    };
  }

  async rescheduleV2(user: AuthUser, body: Record<string, unknown>) {
    this.requireAppAccess(user);
    const visitId = this.toPositiveInteger(body.visitId);
    const assignedUserId = this.toPositiveInteger(body.assignedUserId);
    const expectedRevision = body.expectedRevision;
    const key = typeof body.idempotencyKey === 'string' ? body.idempotencyKey.trim() : '';
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
    if (!visitId || !assignedUserId || !key || key.length > 100 || !remarks ||
        typeof expectedRevision !== 'number' || !Number.isSafeInteger(expectedRevision) ||
        expectedRevision < 0 || expectedRevision >= Number.MAX_SAFE_INTEGER) {
      throw createConfiguredError('VALIDATION_ERROR', 'Invalid reschedule request', 400);
    }
    this.parseScheduledDate(body.scheduledDate, 'UTC');
    const scheduledTime = this.validateTime(body.scheduledTime);
    const scheduledDate = body.scheduledDate as string;
    const keyHash = createHash('sha256').update(key).digest('hex');
    const request = { visitId, scheduledDate, scheduledTime, assignedUserId, remarks, expectedRevision };
    const requestHash = createHash('sha256').update(JSON.stringify([
      'reschedule-v2', visitId, scheduledDate, scheduledTime, assignedUserId, remarks, expectedRevision,
    ])).digest('hex');
    const replay = (operation: { visitId: number; requestHash: string; result: string }) => {
      if (Number(operation.visitId) !== visitId || operation.requestHash !== requestHash) {
        throw createConfiguredError('CONFLICT', 'Reschedule key does not match request', 409, 'RESCHEDULE_IDEMPOTENCY_CONFLICT');
      }
      return JSON.parse(operation.result);
    };

    return db.sequelize.transaction(async (transaction: Transaction) => {
      const plan = await visitPlanRepository.findById(user.hostId, visitId, transaction, true);
      if (!plan) throw createConfiguredError('NOT_FOUND', 'Visit plan not found', 404);
      await customerService.lockCustomerForAssignment(user.hostId, plan.customerId, transaction);
      await this.ensureCustomerAccessible(user, plan.customerId, transaction, true);
      const existing = await visitPlanRepository.findRescheduleOperation(user.hostId, user.id, keyHash, transaction);
      if (existing) return replay(existing);

      const base = { contractVersion: 2, hostId: user.hostId, userId: user.id, key, request };
      let result: Record<string, unknown>;
      if (plan.status !== 'SCHEDULED' || Number(plan.rescheduleRevision) !== expectedRevision) {
        result = { ...base, outcome: 'rejected', reason: plan.status !== 'SCHEDULED' ? 'VISIT_INVALID_TRANSITION' : 'REVISION_CONFLICT' };
      } else {
        const settings = await this.visitDateTimeSettings(user.hostId);
        const date = this.parseScheduledDate(scheduledDate, settings.timeZone);
        const assignee = await this.validateAssignedUser(user.hostId, assignedUserId, user, plan.customerId, transaction);
        await this.ensureAssignmentEligible(user, assignee, 'RESCHEDULE_VISIT', transaction);
        if (Number(assignee) !== Number(plan.assignedUserId)) {
          await this.assignVisitUserToCustomer(user, plan.customerId, assignee, transaction);
        }
        const oldScheduledDate = plan.scheduledDate;
        const oldScheduledTime = plan.scheduledTime;
        const now = Math.floor(Date.now() / 1000);
        await visitPlanRepository.updateVisit(plan, {
          scheduledDate: date, scheduledTime, assignedUserId: assignee, remarks,
          rescheduleRevision: expectedRevision + 1, updatedAt: now,
        }, transaction);
        await visitPlanRepository.historyCreate({
          hostId: user.hostId, visitId, customerId: plan.customerId, eventType: 'VISIT_RESCHEDULED',
          oldScheduledDate, newScheduledDate: date, oldScheduledTime, newScheduledTime: scheduledTime,
          remarks, performedBy: user.id, eventAt: now, createdAt: now, updatedAt: now,
        }, transaction);
        result = {
          ...base,
          outcome: 'confirmed',
          applied: {
            scheduledDate: moment.tz(Number(plan.scheduledDate) * 1000, settings.timeZone).format('YYYY-MM-DD'),
            scheduledTime: plan.scheduledTime ?? null,
            assignedUserId: Number(plan.assignedUserId),
            remarks: plan.remarks,
            revision: Number(plan.rescheduleRevision),
          },
          visit: {
            ...this.formatVisitResponse(plan.toJSON(), settings),
            scheduledDate: moment.tz(Number(plan.scheduledDate) * 1000, settings.timeZone).format('YYYY-MM-DD'),
          },
        };
      }
      await visitPlanRepository.createRescheduleOperation({
        hostId: user.hostId, userId: user.id, visitId, keyHash, requestHash,
        result: JSON.stringify(result), createdAt: Math.floor(Date.now() / 1000),
      }, transaction);
      return result;
    });
  }

  async cancel(user: AuthUser, body: Record<string, unknown>) {
    this.requireAppAccess(user);
    const visitId = this.toPositiveInteger(body.visitId);
    if (!visitId) throw createConfiguredError('VALIDATION_ERROR', 'visitId is required', 400);
    const remarks = typeof body.remarks === 'string' ? body.remarks.trim() : '';
    if (!remarks) throw createConfiguredError('VALIDATION_ERROR', 'remarks are required', 400);
    return db.sequelize.transaction(async (transaction: Transaction) => {
      const plan = await visitPlanRepository.findById(user.hostId, visitId, transaction, true);
      if (!plan) throw createConfiguredError('NOT_FOUND', 'Visit plan not found', 404);
      if (!this.canAccessVisit(user, plan)) throw createConfiguredError('FORBIDDEN', 'Access denied', 403);
      await this.ensureCustomerAccessible(user, plan.customerId, transaction);
      if (plan.status !== 'SCHEDULED') {
        throw createConfiguredError('VISIT_INVALID_TRANSITION', 'Only scheduled visits can be cancelled', 409);
      }
      const now = Math.floor(Date.now() / 1000);
      await visitPlanRepository.updateVisit(
        plan,
        { status: 'CANCELLED', cancellationRemarks: remarks, cancelledAt: now, updatedAt: now },
        transaction
      );
      await visitPlanRepository.historyCreate(
        {
          hostId: user.hostId,
          visitId: plan.id,
          customerId: plan.customerId,
          eventType: 'VISIT_CANCELLED',
          remarks,
          performedBy: user.id,
          eventAt: now,
          createdAt: now,
          updatedAt: now,
        },
        transaction
      );
      return this.formatVisitResponse(plan.toJSON(), await this.visitDateTimeSettings(user.hostId));
    });
  }

  private applyUserVisibility(user: AuthUser, where: Record<string, unknown>): void {
    if (this.isFieldOfficer(user)) {
      where.assignedUserId = user.id;
    }
  }

  private applyCustomerVisibility(
    user: AuthUser,
    hostId: number,
    where: Record<string, unknown>
  ): void {
    if (this.isAdmin(user) || this.isFieldOfficer(user)) return;
    const existing = (where as any)[Op.and];
    const visibility = db.Sequelize.literal(
      `EXISTS (SELECT 1 FROM wd_customers c LEFT JOIN wd_customer_user_assignments cua ` +
      `ON cua.customerId = c.id AND cua.hostId = ${hostId} AND cua.isDeleted = 0 ` +
      `WHERE c.id = VisitPlan.customerId AND c.hostId = ${hostId} AND c.isDeleted = 0 ` +
      `AND (cua.id IS NULL OR cua.userId = ${user.id}))`
    );
    (where as any)[Op.and] = existing
      ? [...(Array.isArray(existing) ? existing : [existing]), visibility]
      : [visibility];
  }

  async list(user: AuthUser, body: Record<string, unknown>, mode: 'today' | 'upcoming') {
    this.requireAppAccess(user);
    const hostId = user.hostId;
    const { timeZone, today, dateTimeSettings } = await this.hostToday(hostId);
    const now = moment.tz(timeZone);
    const nowTime = now.format('HH:mm');
    const page = this.toPositiveInteger(body.page) ?? 1;
    const limit = Math.min(this.toPositiveInteger(body.limit) ?? 20, 100);
    const where: Record<string, unknown> = {};
    if (mode === 'today') {
      where.scheduledDate = today;
      (where as any)[Op.and] = [
        {
          [Op.or]: [
            { scheduledTime: null },
            { scheduledTime: { [Op.gte]: nowTime } },
          ],
        },
      ];
    } else {
      where.scheduledDate = { [Op.gt]: today };
    }
    if (Array.isArray(body.status)) {
      const statuses = body.status.filter(
        (status: unknown): status is VisitPlanStatus =>
          typeof status === 'string' &&
          ['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(status)
      );
      if (statuses.length !== body.status.length) {
        throw createConfiguredError('VALIDATION_ERROR', 'status contains an invalid visit status', 400);
      }
      if (statuses.length) where.status = { [Op.in]: statuses };
    } else if (typeof body.status === 'string') {
      if (['SCHEDULED', 'IN_PROGRESS', 'COMPLETED', 'CANCELLED'].includes(body.status)) {
        where.status = body.status;
      } else {
        throw createConfiguredError('VALIDATION_ERROR', 'Invalid visit status', 400);
      }
    }
    if (this.toPositiveInteger(body.assignedUserId)) {
      where.assignedUserId = this.toPositiveInteger(body.assignedUserId);
    }
    if (typeof body.search === 'string' && body.search.trim()) {
      (where as any)['$customer.customerName$'] = { [Op.like]: `%${body.search.trim()}%` };
    }
    this.applyUserVisibility(user, where);
    this.applyCustomerVisibility(user, hostId, where);
    const order: unknown[][] =
      mode === 'upcoming'
        ? [
            [db.Sequelize.literal('CASE WHEN scheduledTime IS NULL THEN 1 ELSE 0 END'), 'ASC'],
            ['scheduledDate', 'ASC'],
            ['scheduledTime', 'ASC'],
            ['createdAt', 'ASC'],
            ['id', 'ASC'],
          ]
        : [
            [db.Sequelize.literal('CASE WHEN scheduledTime IS NULL THEN 1 ELSE 0 END'), 'ASC'],
            ['scheduledDate', 'ASC'],
            ['scheduledTime', 'ASC'],
            ['createdAt', 'ASC'],
            ['id', 'ASC'],
          ];
    const result = await visitPlanRepository.findAndCount(hostId, where, page, limit, order);
    const rows = result.rows.map((row: any) => {
      const data = row.toJSON();
      data.overdue = false;
      data.hostTimeZone = timeZone;
      return data;
    });
    return {
      visits: this.formatVisitResponse(rows, dateTimeSettings),
      pagination: {
        total: result.count,
        page,
        limit,
        totalPages: Math.ceil(result.count / limit),
      },
      hostTimeZone: timeZone,
    };
  }

  async overdue(user: AuthUser, body: Record<string, unknown>) {
    this.requireAppAccess(user);
    const hostId = user.hostId;
    const { timeZone, dateTimeSettings } = await this.hostToday(hostId);
    const page = this.toPositiveInteger(body.page) ?? 1;
    const limit = Math.min(this.toPositiveInteger(body.limit) ?? 20, 100);
    const nowMoment = moment.tz(timeZone);
    const today = nowMoment.clone().startOf('day').unix();
    const nowTime = nowMoment.format('HH:mm');

    const where: Record<string, unknown> = {
      [Op.or]: [
        {
          scheduledTime: null,
          scheduledDate: { [Op.lt]: today },
        },
        {
          scheduledTime: { [Op.ne]: null },
          [Op.or]: [
            { scheduledDate: { [Op.lt]: today } },
            {
              scheduledDate: today,
              scheduledTime: { [Op.lt]: nowTime },
            },
          ],
        },
      ],
    };

    if (this.toPositiveInteger(body.assignedUserId)) {
      (where as any).assignedUserId = this.toPositiveInteger(body.assignedUserId);
    }
    if (typeof body.search === 'string' && body.search.trim()) {
      (where as any)['$customer.customerName$'] = { [Op.like]: `%${body.search.trim()}%` };
    }

    const order: unknown[][] = [
      [db.Sequelize.literal('CASE WHEN scheduledTime IS NULL THEN 1 ELSE 0 END'), 'ASC'],
      ['scheduledDate', 'ASC'],
      ['scheduledTime', 'ASC'],
      ['createdAt', 'ASC'],
      ['id', 'ASC'],
    ];
    this.applyCustomerVisibility(user, hostId, where);
    const result = await visitPlanRepository.findAndCount(
      hostId,
      {
        ...where,
        status: { [Op.in]: ['SCHEDULED', 'IN_PROGRESS'] },
        ...(this.isFieldOfficer(user) ? { assignedUserId: user.id } : {}),
      },
      page,
      limit,
      order
    );
    const rows = result.rows.map((row: any) => ({
      ...row.toJSON(),
      overdue: true,
      hostTimeZone: timeZone,
    }));
    return {
      visits: this.formatVisitResponse(rows, dateTimeSettings),
      pagination: {
        total: result.count,
        page,
        limit,
        totalPages: Math.ceil(result.count / limit),
      },
      hostTimeZone: timeZone,
    };
  }

  async customerHistory(user: AuthUser, body: Record<string, unknown>) {
    this.requireAppAccess(user);
    const hostId = user.hostId;
    const customer = await this.resolveCustomer(hostId, body);
    await this.ensureCustomerAccessible(user, customer.id);
    const page = this.toPositiveInteger(body.page) ?? 1;
    const limit = Math.min(this.toPositiveInteger(body.limit) ?? 20, 100);
    const result = await visitPlanRepository.findAndCount(
      hostId,
      { customerId: customer.id },
      page,
      limit,
      [['scheduledDate', 'DESC'], ['createdAt', 'DESC']]
    );
    const data = result.rows.map((row: any) => row.toJSON());
    const historyRows = await visitPlanRepository.getHistoryForVisitIds(
      hostId,
      data.map((plan: any) => Number(plan.id))
    );
    const historyByVisit = new Map<number, unknown[]>();
    historyRows.forEach((history: any) => {
      const visitId = Number(history.visitId);
      const entries = historyByVisit.get(visitId) ?? [];
      entries.push(history.toJSON ? history.toJSON() : history);
      historyByVisit.set(visitId, entries);
    });
    for (const plan of data) {
      (plan as any).history = historyByVisit.get(Number(plan.id)) ?? [];
    }
    const settings = await this.visitDateTimeSettings(hostId);
    return {
      customer: this.formatVisitResponse(customer.toJSON(), settings),
      visits: this.formatVisitResponse(data, settings),
      pagination: {
        total: result.count,
        page,
        limit,
        totalPages: Math.ceil(result.count / limit),
      },
    };
  }

  async details(user: AuthUser, body: Record<string, unknown>) {
    this.requireAppAccess(user);
    const visitId = this.toPositiveInteger(body.visitId);
    if (!visitId) throw createConfiguredError('VALIDATION_ERROR', 'visitId is required', 400);
    const plan = await visitPlanRepository.findById(user.hostId, visitId);
    if (!plan) throw createConfiguredError('NOT_FOUND', 'Visit plan not found', 404);
    if (!this.canAccessVisit(user, plan)) throw createConfiguredError('FORBIDDEN', 'Access denied', 403);
    await this.ensureCustomerAccessible(user, plan.customerId);
    const result = await visitPlanRepository.findAndCount(
      user.hostId,
      { id: plan.id },
      1,
      1,
      [['id', 'DESC']]
    );
    const visit: any = result.rows[0]?.toJSON() ?? plan.toJSON();
    const history = await visitPlanRepository.getHistory(user.hostId, visitId);
    let checkInVisit = null;
    if (plan.checkInVisitId) {
      checkInVisit =
        (await visitPlanRepository.findCheckInVisit(
          user.hostId,
          plan.assignedUserId,
          plan.checkInVisitId
        ))?.toJSON() ?? null;
    }
    const settings = await this.visitDateTimeSettings(user.hostId);
    return this.formatVisitResponse(
      {
        visit,
        customer: visit.customer ?? null,
        assignedUser: visit.assignedUser ?? null,
        checkInVisit,
        history: history.map((entry) => entry.toJSON()),
      },
      settings
    );
  }

  async onExistingVisitCheckIn(
    hostId: number,
    visit: Record<string, unknown>,
    performedBy: number,
    transaction: Transaction
  ): Promise<void> {
    const customerId = this.toPositiveInteger(visit.customerId);
    const visitId = this.toPositiveInteger(visit.id);
    if (!customerId || !visitId) return;
    const assignedUserId = this.toPositiveInteger(visit.userId);
    if (!assignedUserId) return;
    const checkInAt = this.toPositiveInteger(visit.checkInTime);
    if (!checkInAt) return;

    let plan = null;
    const explicitPlanId = this.toPositiveInteger(
      (visit as Record<string, unknown>).plannedVisitId ??
        (visit as Record<string, unknown>).visitPlanId
    );
    if (explicitPlanId) {
      plan = await visitPlanRepository.findById(hostId, explicitPlanId, transaction, true);
      if (
        !plan ||
        plan.customerId !== customerId ||
        plan.assignedUserId !== assignedUserId ||
        plan.status !== 'SCHEDULED'
      ) {
        return;
      }
    } else {
      const settings = await getHostDateTimeSettings(hostId);
      const timeZone = moment.tz.zone(settings.timeZone) ? settings.timeZone : 'UTC';
      const scheduledDate = moment.tz(checkInAt * 1000, timeZone).startOf('day').unix();
      const candidates = await visitPlanRepository.findEligibleForCheckIn(
        hostId,
        customerId,
        assignedUserId,
        scheduledDate,
        transaction
      );
      if (candidates.length !== 1) return;
      plan = candidates[0];
    }
    if (plan.checkInVisitId && plan.checkInVisitId !== visitId) return;
    const now = Math.floor(Date.now() / 1000);
    await visitPlanRepository.updateVisit(
      plan,
      { status: 'IN_PROGRESS', checkInVisitId: visitId, checkInAt, updatedAt: now },
      transaction
    );
    const existing = await db.VisitPlanHistory.findOne({
      where: { hostId, visitId: plan.id, eventType: 'VISIT_CHECKED_IN', isDeleted: 0 },
      transaction,
    });
    if (!existing) {
      await visitPlanRepository.historyCreate(
        {
          hostId,
          visitId: plan.id,
          customerId,
          eventType: 'VISIT_CHECKED_IN',
          remarks: 'Existing customer check-in linked',
          performedBy,
          eventAt: checkInAt,
          createdAt: now,
          updatedAt: now,
        },
        transaction
      );
    }
  }

  async onExistingVisitCompletion(
    hostId: number,
    visit: Record<string, unknown>,
    performedBy: number,
    transaction: Transaction
  ): Promise<void> {
    const visitId = this.toPositiveInteger(visit.id);
    if (!visitId) return;
    const checkOutTime = this.toPositiveInteger(visit.checkOutTime);
    if (!checkOutTime) return;
    const plan = await visitPlanRepository.findCheckInLinkedPlan(hostId, visitId, transaction);
    if (!plan || plan.status === 'COMPLETED') return;
    if (plan.status !== 'IN_PROGRESS') return;
    const now = Math.floor(Date.now() / 1000);
    await visitPlanRepository.updateVisit(
      plan,
      { status: 'COMPLETED', completedAt: checkOutTime, updatedAt: now },
      transaction
    );
    const existing = await db.VisitPlanHistory.findOne({
      where: { hostId, visitId: plan.id, eventType: 'VISIT_COMPLETED', isDeleted: 0 },
      transaction,
    });
    if (!existing) {
      await visitPlanRepository.historyCreate(
        {
          hostId,
          visitId: plan.id,
          customerId: plan.customerId,
          eventType: 'VISIT_COMPLETED',
          remarks: 'Existing customer visit completion linked',
          performedBy,
          eventAt: checkOutTime,
          createdAt: now,
          updatedAt: now,
        },
        transaction
      );
    }
  }
}

export default new VisitPlanService();
