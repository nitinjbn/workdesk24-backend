import { FindAndCountOptions, Op, Transaction } from 'sequelize';
import {
  LeaveRequest,
  LeaveRequestApproval,
  LeaveRequestDay,
  LeaveType,
  LeaveYear,
  User,
} from '../../../models';
import { buildPagination, buildSafeOrder, resolvePagination } from './query-safety.util';

export class LeaveRequestApprovalRepository {
  async getPendingLeaveRequests(params: {
    hostId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<{ data: any[]; pagination?: any }> {
    const { hostId, filter, page, limit, sortBy, sortOrder } = params;

    const where: any = {
      hostId,
      status: 'PENDING',
      isDeleted: 0,
    };

    if (filter) {
      if (filter.userId !== undefined) {
        where.userId = filter.userId;
      }
      if (filter.leaveYearId !== undefined) {
        where.leaveYearId = filter.leaveYearId;
      }
      if (filter.leaveTypeId !== undefined) {
        where.leaveTypeId = filter.leaveTypeId;
      }
      if (filter.fromDate) {
        where.fromDate = {
          [Op.gte]: filter.fromDate,
        };
      }
      if (filter.tillDate) {
        where.tillDate = {
          [Op.lte]: filter.tillDate,
        };
      }
      if (filter.status !== undefined) {
        where.status = filter.status;
      }
      if (filter.leaveDate) {
        where.fromDate = {
          [Op.gte]: [filter.leaveDate],
        };
        where.tillDate = {
          [Op.lte]: [filter.leaveDate],
        };
      }
    }

    const order = buildSafeOrder({
      sortBy,
      sortOrder,
      allowedSortBy: [
        'id',
        'fromDate',
        'tillDate',
        'submittedAt',
        'createdAt',
        'updatedAt',
        'totalDays',
      ],
      defaultOrder: [
        ['submittedAt', 'ASC'],
        ['id', 'ASC'],
      ],
    });

    const query: FindAndCountOptions<any> = {
      where,
      order,
      include: [
        {
          model: User,
          as: 'user',
          required: true,
          where: {
            hostId,
            isDeleted: 0,
          },
          attributes: ['id', 'name', 'email', 'reportingManagerId'],
        },
        {
          model: LeaveType,
          as: 'leaveType',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
        {
          model: LeaveYear,
          as: 'leaveYear',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
      ],
    };

    const pagination = resolvePagination(page, limit);

    if (pagination) {
      query.limit = pagination.limit;
      query.offset = pagination.offset;

      const { rows, count } = await LeaveRequest.findAndCountAll(query);
      const total = Array.isArray(count) ? count.length : count;

      return {
        data: rows,
        pagination: buildPagination(total, pagination.page, pagination.limit),
      };
    }

    const rows = await LeaveRequest.findAll(query);
    return { data: rows };
  }

  async getLeaveRequestById(hostId: number, leaveRequestId: number): Promise<any | null> {
    return LeaveRequest.findOne({
      where: {
        hostId,
        id: leaveRequestId,
        isDeleted: 0,
      },
      include: [
        {
          model: User,
          as: 'user',
          required: false,
          where: { hostId, isDeleted: 0 },
          attributes: ['id', 'name', 'email', 'reportingManagerId'],
        },
        {
          model: LeaveType,
          as: 'leaveType',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
        {
          model: LeaveYear,
          as: 'leaveYear',
          required: false,
          where: { hostId, isDeleted: 0 },
        },
      ],
    } as any);
  }

  async getLeaveRequestByIdForUpdate(
    hostId: number,
    leaveRequestId: number,
    transaction: Transaction
  ): Promise<any | null> {
    return LeaveRequest.findOne({
      where: {
        hostId,
        id: leaveRequestId,
        isDeleted: 0,
      },
      transaction,
      lock: transaction.LOCK.UPDATE,
    } as any);
  }

  async getLeaveRequestDays(hostId: number, leaveRequestId: number): Promise<any[]> {
    return LeaveRequestDay.findAll({
      where: {
        hostId,
        leaveRequestId,
      },
      order: [['leaveDate', 'ASC']],
    } as any);
  }

  async getApprovalHistory(hostId: number, leaveRequestId: number): Promise<any[]> {
    return LeaveRequestApproval.findAll({
      where: {
        hostId,
        leaveRequestId,
      },
      include: [
        {
          model: User,
          as: 'approver',
          required: false,
          where: { hostId, isDeleted: 0 },
          attributes: ['id', 'name', 'email'],
        },
      ],
      order: [['createdAt', 'ASC']],
    } as any);
  }

  async getUserById(
    hostId: number,
    userId: number,
    transaction?: Transaction
  ): Promise<any | null> {
    return User.findOne({
      where: {
        hostId,
        id: userId,
        isDeleted: 0,
      },
      transaction,
      attributes: [
        'id',
        'name',
        'email',
        'roleId',
        'reportingManagerId',
        'isFieldAppUser',
        'isAdminUser',
      ],
    } as any);
  }

  async updateLeaveRequestStatus(payload: {
    hostId: number;
    leaveRequestId: number;
    status: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    approvedAt?: number | null;
    rejectedAt?: number | null;
    cancelledAt?: number | null;
    withdrawnAt?: number | null;
    transaction: Transaction;
  }): Promise<any | null> {
    const request = await this.getLeaveRequestByIdForUpdate(
      payload.hostId,
      payload.leaveRequestId,
      payload.transaction
    );

    if (!request) {
      return null;
    }

    const now = Math.floor(Date.now() / 1000);
    await request.update(
      {
        status: payload.status,
        approvedAt:
          payload.approvedAt !== undefined ? payload.approvedAt : (request as any).approvedAt,
        rejectedAt:
          payload.rejectedAt !== undefined ? payload.rejectedAt : (request as any).rejectedAt,
        cancelledAt:
          payload.cancelledAt !== undefined ? payload.cancelledAt : (request as any).cancelledAt,
        withdrawnAt:
          payload.withdrawnAt !== undefined ? payload.withdrawnAt : (request as any).withdrawnAt,
        updatedAt: now,
      } as any,
      { transaction: payload.transaction }
    );

    return request;
  }

  async createApprovalAudit(payload: {
    hostId: number;
    leaveRequestId: number;
    approverUserId: number;
    action: 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    previousStatus?: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    newStatus: 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';
    comment?: string;
    transaction: Transaction;
  }): Promise<any> {
    const now = Math.floor(Date.now() / 1000);

    return LeaveRequestApproval.create(
      {
        hostId: payload.hostId,
        leaveRequestId: payload.leaveRequestId,
        approverUserId: payload.approverUserId,
        action: payload.action,
        previousStatus: payload.previousStatus || null,
        newStatus: payload.newStatus,
        comment: payload.comment?.trim() || null,
        createdAt: now,
      } as any,
      { transaction: payload.transaction }
    );
  }
}

export default new LeaveRequestApprovalRepository();
