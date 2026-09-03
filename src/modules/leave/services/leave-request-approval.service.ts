import { sequelize } from '../../../models';
import { isAdminRole } from '../../../shared/utils/jwt.util';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import { formatDateTimeFieldsBySettings } from '../../../shared/utils/date-time-format.util';
import leaveBalanceService from './leave-balance.service';
import leaveRequestApprovalRepository from '../repositories/leave-request-approval.repository';
import dashboardCacheInvalidationService from '../../dashboard/services/dashboard-cache-invalidation.service';

type LeaveStatus = 'DRAFT' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'CANCELLED' | 'WITHDRAWN';

export class LeaveRequestApprovalService {
  private async assertApproverAuthorized(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    requestOwnerUserId: number;
  }): Promise<void> {
    const { hostId, approverUserId, approverRoleId, requestOwnerUserId } = payload;

    const [approver, requestOwner] = await Promise.all([
      leaveRequestApprovalRepository.getUserById(hostId, approverUserId),
      leaveRequestApprovalRepository.getUserById(hostId, requestOwnerUserId),
    ]);

    if (!approver) {
      throw createConfiguredError('USER_NOT_FOUND', 'Approver user not found', 404);
    }

    if (!requestOwner) {
      throw createConfiguredError('USER_NOT_FOUND', 'Request owner user not found', 404);
    }

    const admin = await isAdminRole(hostId, approverRoleId);
    const manager = Number((requestOwner as any).reportingManagerId || 0) === Number(approverUserId);

    if (!admin && !manager) {
      throw createConfiguredError(
        'LEAVE_APPROVER_NOT_AUTHORIZED',
        'You are not authorized to approve/reject/cancel this leave request',
        403
      );
    }
  }

  private assertAllowedTransition(currentStatus: LeaveStatus, targetStatus: LeaveStatus): void {
    const transitions: Record<LeaveStatus, LeaveStatus[]> = {
      DRAFT: ['PENDING', 'CANCELLED'],
      PENDING: ['APPROVED', 'REJECTED', 'WITHDRAWN', 'CANCELLED'],
      APPROVED: ['CANCELLED'],
      REJECTED: [],
      CANCELLED: [],
      WITHDRAWN: [],
    };

    if (!transitions[currentStatus].includes(targetStatus)) {
      throw createConfiguredError(
        'INVALID_REQUEST_STATUS_TRANSITION',
        `Cannot transition leave request from ${currentStatus} to ${targetStatus}`,
        400
      );
    }
  }

  private shouldInvalidateDashboardForLeaveChange(currentStatus: LeaveStatus, targetStatus: LeaveStatus): boolean {
    return currentStatus === 'APPROVED' || targetStatus === 'APPROVED';
  }

  async listPendingLeaveRequests(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    filter?: Record<string, unknown>;
    page?: number;
    limit?: number;
    sortBy?: string;
    sortOrder?: 'ASC' | 'DESC';
  }): Promise<any> {
    const { hostId, approverUserId, approverRoleId, filter, page, limit, sortBy, sortOrder } = payload;

    const admin = await isAdminRole(hostId, approverRoleId);

    const report = await leaveRequestApprovalRepository.getPendingLeaveRequests({
      hostId,
      managerUserId: admin ? undefined : approverUserId,
      filter,
      page,
      limit,
      sortBy,
      sortOrder,
    });

    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const data = report.data.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      requests: formatDateTimeFieldsBySettings(data, dateTimeSettings),
      pagination: report.pagination,
    };
  }

  async getLeaveRequestDetails(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
  }): Promise<any> {
    const { hostId, approverUserId, approverRoleId, leaveRequestId } = payload;

    const request = await leaveRequestApprovalRepository.getLeaveRequestById(hostId, leaveRequestId);
    if (!request) {
      throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
    }

    await this.assertApproverAuthorized({
      hostId,
      approverUserId,
      approverRoleId,
      requestOwnerUserId: Number((request as any).userId),
    });

    const [days, approvals] = await Promise.all([
      leaveRequestApprovalRepository.getLeaveRequestDays(hostId, leaveRequestId),
      leaveRequestApprovalRepository.getApprovalHistory(hostId, leaveRequestId),
    ]);

    const requestPlain = request && typeof request.toJSON === 'function' ? request.toJSON() : request;
    const dayPlain = days.map((item: any) => (item && typeof item.toJSON === 'function' ? item.toJSON() : item));
    const approvalPlain = approvals.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    const dateTimeSettings = await getHostDateTimeSettings(hostId);

    return {
      request: formatDateTimeFieldsBySettings(
        {
          ...requestPlain,
          days: dayPlain,
          approvals: approvalPlain,
        },
        dateTimeSettings
      ),
    };
  }

  private async transitionRequest(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
    targetStatus: LeaveStatus;
    action: 'APPROVED' | 'REJECTED' | 'CANCELLED';
    comment?: string;
  }): Promise<any> {
    const {
      hostId,
      approverUserId,
      approverRoleId,
      leaveRequestId,
      targetStatus,
      action,
      comment,
    } = payload;

    const transaction = await sequelize.transaction();

    try {
      const request = await leaveRequestApprovalRepository.getLeaveRequestByIdForUpdate(
        hostId,
        leaveRequestId,
        transaction
      );

      if (!request) {
        throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
      }

      const currentStatus = String((request as any).status) as LeaveStatus;

      await this.assertApproverAuthorized({
        hostId,
        approverUserId,
        approverRoleId,
        requestOwnerUserId: Number((request as any).userId),
      });

      // idempotent handling for duplicate concurrent actions
      if (currentStatus === targetStatus) {
        await transaction.commit();
        return this.getLeaveRequestDetails({
          hostId,
          approverUserId,
          approverRoleId,
          leaveRequestId,
        });
      }

      this.assertAllowedTransition(currentStatus, targetStatus);

      const now = Math.floor(Date.now() / 1000);

      await leaveRequestApprovalRepository.updateLeaveRequestStatus({
        hostId,
        leaveRequestId,
        status: targetStatus,
        approvedAt: targetStatus === 'APPROVED' ? now : undefined,
        rejectedAt: targetStatus === 'REJECTED' ? now : undefined,
        cancelledAt: targetStatus === 'CANCELLED' ? now : undefined,
        transaction,
      });

      await leaveRequestApprovalRepository.createApprovalAudit({
        hostId,
        leaveRequestId,
        approverUserId,
        action,
        previousStatus: currentStatus,
        newStatus: targetStatus,
        comment,
        transaction,
      });

      const totalDays = Number((request as any).totalDays || 0);
      const leaveYearId = Number((request as any).leaveYearId);
      const leaveTypeId = Number((request as any).leaveTypeId);
      const requestOwnerUserId = Number((request as any).userId);

      if (currentStatus === 'PENDING' && targetStatus === 'APPROVED') {
        await leaveBalanceService.applyBalanceChange({
          hostId,
          userId: requestOwnerUserId,
          leaveYearId,
          leaveTypeId,
          transactionType: 'LEAVE_DEBIT',
          quantity: totalDays,
          reason: `Leave request approved: ${leaveRequestId}`,
          createdBy: approverUserId,
          deltas: {
            pendingBalanceDelta: -totalDays,
            usedBalanceDelta: totalDays,
          },
          transaction,
        });
      }

      if (currentStatus === 'PENDING' && ['REJECTED', 'CANCELLED', 'WITHDRAWN'].includes(targetStatus)) {
        await leaveBalanceService.applyBalanceChange({
          hostId,
          userId: requestOwnerUserId,
          leaveYearId,
          leaveTypeId,
          transactionType: 'LEAVE_REVERSAL',
          quantity: -totalDays,
          reason: `Leave request ${targetStatus.toLowerCase()}: ${leaveRequestId}`,
          createdBy: approverUserId,
          deltas: {
            pendingBalanceDelta: -totalDays,
          },
          transaction,
        });
      }

      if (currentStatus === 'APPROVED' && targetStatus === 'CANCELLED') {
        await leaveBalanceService.applyBalanceChange({
          hostId,
          userId: requestOwnerUserId,
          leaveYearId,
          leaveTypeId,
          transactionType: 'LEAVE_REVERSAL',
          quantity: -totalDays,
          reason: `Approved leave request cancelled: ${leaveRequestId}`,
          createdBy: approverUserId,
          deltas: {
            usedBalanceDelta: -totalDays,
          },
          transaction,
        });
      }

      await transaction.commit();

      if (this.shouldInvalidateDashboardForLeaveChange(currentStatus, targetStatus)) {
        await dashboardCacheInvalidationService.invalidateOverview({
          hostId,
          event: 'leave.status_changed',
          occurredAt: (request as any).fromDate,
          previousOccurredAt: (request as any).tillDate,
        });
      }

      return this.getLeaveRequestDetails({
        hostId,
        approverUserId,
        approverRoleId,
        leaveRequestId,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  private async transitionRequestV1(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
    targetStatus: LeaveStatus;
    action: 'APPROVED' | 'REJECTED' | 'CANCELLED';
    comment?: string;
  }): Promise<any> {
    const {
      hostId,
      approverUserId,
      approverRoleId,
      leaveRequestId,
      targetStatus,
      action,
      comment,
    } = payload;

    const transaction = await sequelize.transaction();

    try {
      const request = await leaveRequestApprovalRepository.getLeaveRequestByIdForUpdate(
        hostId,
        leaveRequestId,
        transaction
      );

      if (!request) {
        throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
      }

      const currentStatus = String((request as any).status) as LeaveStatus;

      await this.assertApproverAuthorized({
        hostId,
        approverUserId,
        approverRoleId,
        requestOwnerUserId: Number((request as any).userId),
      });

      // idempotent handling for duplicate concurrent actions
      if (currentStatus === targetStatus) {
        await transaction.commit();
        return this.getLeaveRequestDetails({
          hostId,
          approverUserId,
          approverRoleId,
          leaveRequestId,
        });
      }

      this.assertAllowedTransition(currentStatus, targetStatus);

      const now = Math.floor(Date.now() / 1000);

      await leaveRequestApprovalRepository.updateLeaveRequestStatus({
        hostId,
        leaveRequestId,
        status: targetStatus,
        approvedAt: targetStatus === 'APPROVED' ? now : undefined,
        rejectedAt: targetStatus === 'REJECTED' ? now : undefined,
        cancelledAt: targetStatus === 'CANCELLED' ? now : undefined,
        transaction,
      });

      await leaveRequestApprovalRepository.createApprovalAudit({
        hostId,
        leaveRequestId,
        approverUserId,
        action,
        previousStatus: currentStatus,
        newStatus: targetStatus,
        comment,
        transaction,
      });

      await transaction.commit();

      if (this.shouldInvalidateDashboardForLeaveChange(currentStatus, targetStatus)) {
        await dashboardCacheInvalidationService.invalidateOverview({
          hostId,
          event: 'leave.status_changed',
          occurredAt: (request as any).fromDate,
          previousOccurredAt: (request as any).tillDate,
        });
      }

      return this.getLeaveRequestDetails({
        hostId,
        approverUserId,
        approverRoleId,
        leaveRequestId,
      });
    } catch (error) {
      await transaction.rollback();
      throw error;
    }
  }

  async approveLeaveRequest(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
    comment?: string;
  }): Promise<any> {
    return this.transitionRequest({
      ...payload,
      targetStatus: 'APPROVED',
      action: 'APPROVED',
    });
  }

  async rejectLeaveRequest(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
    comment?: string;
  }): Promise<any> {
    return this.transitionRequest({
      ...payload,
      targetStatus: 'REJECTED',
      action: 'REJECTED',
    });
  }

  async approveLeaveRequestV1(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
    comment?: string;
  }): Promise<any> {
    return this.transitionRequestV1({
      ...payload,
      targetStatus: 'APPROVED',
      action: 'APPROVED',
    });
  }

  async rejectLeaveRequestV1(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
    comment?: string;
  }): Promise<any> {
    return this.transitionRequestV1({
      ...payload,
      targetStatus: 'REJECTED',
      action: 'REJECTED',
    });
  }

  async cancelLeaveRequest(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
    comment?: string;
  }): Promise<any> {
    return this.transitionRequest({
      ...payload,
      targetStatus: 'CANCELLED',
      action: 'CANCELLED',
    });
  }

  async viewApprovalHistory(payload: {
    hostId: number;
    approverUserId: number;
    approverRoleId: number;
    leaveRequestId: number;
  }): Promise<any> {
    const { hostId, approverUserId, approverRoleId, leaveRequestId } = payload;

    const request = await leaveRequestApprovalRepository.getLeaveRequestById(hostId, leaveRequestId);
    if (!request) {
      throw createConfiguredError('LEAVE_REQUEST_NOT_FOUND', 'Leave request not found', 404);
    }

    await this.assertApproverAuthorized({
      hostId,
      approverUserId,
      approverRoleId,
      requestOwnerUserId: Number((request as any).userId),
    });

    const approvals = await leaveRequestApprovalRepository.getApprovalHistory(hostId, leaveRequestId);
    const dateTimeSettings = await getHostDateTimeSettings(hostId);
    const approvalPlain = approvals.map((item: any) =>
      item && typeof item.toJSON === 'function' ? item.toJSON() : item
    );

    return {
      leaveRequestId,
      approvals: formatDateTimeFieldsBySettings(approvalPlain, dateTimeSettings),
    };
  }
}

export default new LeaveRequestApprovalService();
