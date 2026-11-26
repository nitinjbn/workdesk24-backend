import { FindAndCountOptions, Op, Transaction, WhereOptions } from 'sequelize';
import db, {
  Customer,
  CustomerUserAssignment,
  User,
  Visit,
  VisitPlan,
  VisitPlanHistory,
} from '../../../models';
import type { VisitPlanStatus } from '../../../models/schemas/VisitPlan';

export class VisitPlanRepository {
  async resolveCustomer(
    hostId: number,
    customerId: number,
    transaction?: Transaction
  ): Promise<typeof Customer.prototype | null> {
    return Customer.findOne({
      where: { id: customerId, hostId, isDeleted: 0 },
      transaction,
    });
  }

  async findCustomersByLocalId(hostId: number, localId: string, transaction?: Transaction) {
    return Customer.findAll({
      where: { hostId, localId, isDeleted: 0 },
      limit: 2,
      transaction,
    });
  }

  async findUser(hostId: number, userId: number, transaction?: Transaction) {
    return User.findOne({
      where: {
        id: userId,
        hostId,
        isDeleted: 0,
        accountStatus: 'ACTIVE',
        isFieldAppUser: 1,
      },
      transaction,
    });
  }

  async findCustomerAssignments(hostId: number, customerId: number, transaction?: Transaction, lock = false) {
    return CustomerUserAssignment.findAll({
      where: { hostId, customerId, isDeleted: 0 },
      attributes: ['userId'],
      transaction,
      lock: transaction && lock ? transaction.LOCK.UPDATE : undefined,
      raw: true,
    });
  }

  async findById(hostId: number, visitId: number, transaction?: Transaction, lock = false) {
    return VisitPlan.findOne({
      where: { id: visitId, hostId, isDeleted: 0 },
      transaction,
      lock: transaction && lock ? transaction.LOCK.UPDATE : undefined,
    });
  }

  async findIdempotent(hostId: number, idempotencyKey: string, transaction?: Transaction) {
    return VisitPlan.findOne({
      where: { hostId, idempotencyKey, isDeleted: 0 },
      transaction,
    });
  }

  async findDuplicate(
    hostId: number,
    customerId: number,
    scheduledDate: number,
    excludeVisitId?: number,
    transaction?: Transaction
  ) {
    return VisitPlan.findOne({
      where: {
        hostId,
        customerId,
        scheduledDate,
        status: { [Op.in]: ['SCHEDULED', 'IN_PROGRESS'] },
        isDeleted: 0,
        ...(excludeVisitId ? { id: { [Op.ne]: excludeVisitId } } : {}),
      },
      transaction,
    });
  }

  async create(payload: Record<string, unknown>, transaction: Transaction) {
    return VisitPlan.create(payload as any, { transaction });
  }

  async historyCreate(payload: Record<string, unknown>, transaction: Transaction) {
    return VisitPlanHistory.create(payload as any, { transaction });
  }

  async updateVisit(
    visit: typeof VisitPlan.prototype,
    payload: Record<string, unknown>,
    transaction: Transaction
  ) {
    return visit.update(payload as any, { transaction });
  }

  async findAndCount(
    hostId: number,
    where: Record<string, unknown>,
    page: number,
    limit: number,
    order: unknown[][],
    includeCustomer = true
  ) {
    const include: unknown[] = [
      {
        model: User,
        as: 'assignedUser',
        attributes: ['id', 'name', 'employeeCode'],
        required: true,
        where: { hostId, isDeleted: 0 },
      },
    ];
    if (includeCustomer) {
      include.unshift({
        model: Customer,
        as: 'customer',
        attributes: ['id', 'localId', 'customerName', 'customerCode', 'mobile'],
        required: true,
        where: { hostId, isDeleted: 0 },
      });
    }
    const options: FindAndCountOptions<any> = {
      where: { hostId, isDeleted: 0, ...where } as WhereOptions<any>,
      include: include as any,
      limit,
      offset: (page - 1) * limit,
      order: order as any,
      distinct: true,
    };
    return VisitPlan.findAndCountAll(options);
  }

  async findOverdue(
    hostId: number,
    userId: number,
    isAdmin: boolean,
    isFieldOfficer: boolean,
    page: number,
    limit: number,
    where: Record<string, unknown>,
    order: unknown[][],
    transaction?: Transaction
  ) {
    const scopedWhere: Record<string, unknown> = {
      hostId,
      isDeleted: 0,
      status: { [Op.in]: ['SCHEDULED', 'IN_PROGRESS'] },
      ...where,
    };
    if (!isAdmin && isFieldOfficer) {
      scopedWhere.assignedUserId = userId;
    }
    return this.findAndCount(hostId, scopedWhere, page, limit, order);
  }

  async getHistory(hostId: number, visitId: number) {
    return VisitPlanHistory.findAll({
      where: { hostId, visitId, isDeleted: 0 },
      order: [['eventAt', 'ASC'], ['id', 'ASC']],
    });
  }

  async getHistoryForVisitIds(hostId: number, visitIds: number[]) {
    if (!visitIds.length) return [];
    return VisitPlanHistory.findAll({
      where: {
        hostId,
        visitId: { [Op.in]: visitIds },
        isDeleted: 0,
      },
      order: [['visitId', 'ASC'], ['eventAt', 'ASC'], ['id', 'ASC']],
    });
  }

  async findEligibleForCheckIn(
    hostId: number,
    customerId: number,
    assignedUserId: number,
    scheduledDate: number,
    transaction?: Transaction
  ) {
    return VisitPlan.findAll({
      where: {
        hostId,
        customerId,
        assignedUserId,
        scheduledDate,
        status: 'SCHEDULED',
        isDeleted: 0,
      },
      limit: 2,
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
  }

  async findCheckInVisit(hostId: number, userId: number, visitId: number, transaction?: Transaction) {
    return Visit.findOne({
      where: { id: visitId, hostId, userId, isDeleted: 0 },
      transaction,
    });
  }

  async findCheckInLinkedPlan(hostId: number, visitId: number, transaction?: Transaction) {
    return VisitPlan.findOne({
      where: { hostId, checkInVisitId: visitId, isDeleted: 0 },
      transaction,
      lock: transaction ? transaction.LOCK.UPDATE : undefined,
    });
  }
}

export default new VisitPlanRepository();
