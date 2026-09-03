import { Op, QueryTypes } from 'sequelize';
import moment from 'moment-timezone';
import db from '../../../models';
import type { DashboardResolvedDateRange, DashboardResolvedFilters, DashboardTrendGranularity, DashboardTrendPoint } from '../types/dashboard.types';

interface DashboardAggregateScope {
  hostId: number;
  range: DashboardResolvedDateRange;
  todayRange: DashboardResolvedDateRange;
  filters: DashboardResolvedFilters;
  granularity: DashboardTrendGranularity;
}

interface DashboardKpiCounts {
  totalEmployees: number;
  presentToday: number;
  onLeaveToday: number;
  totalVisits: number;
  totalOrders: number;
  totalPaymentAmount: number;
  pendingDayovers: number;
}

interface DashboardDayoverCounts {
  completed: number;
  pending: number;
  missing: number;
}

interface DashboardVisitCounts {
  totalVisits: number;
  completed: number;
  inProgress: number;
}

interface DashboardOrderCounts {
  totalOrders: number;
  totalOrderAmount: number;
}

interface DashboardPaymentCounts {
  totalPayments: number;
  totalPaymentAmount: number;
}

interface DashboardFeedbackCounts {
  totalFeedback: number;
}

interface DashboardImageCounts {
  totalUploaded: number;
}

interface SummaryTrendRow {
  bucketDate: number | string;
  present: number | string;
  totalVisits: number | string;
  totalOrders: number | string;
  totalOrderAmount: number | string;
  totalPayments: number | string;
  totalPaymentAmount: number | string;
  totalFeedback: number | string;
  totalUploaded: number | string;
}

interface LeaveTrendRow {
  leaveDate: string;
  onLeave: number | string;
}

export class DashboardOverviewRepository {
  public async resolveScopedEmployeeIds(hostId: number, filters: DashboardResolvedFilters): Promise<number[] | undefined> {
    const where: Record<string, unknown> = {
      hostId,
      isDeleted: 0,
      accountStatus: 'ACTIVE',
    };

    if (filters.employeeIds?.length) {
      where.id = { [Op.in]: filters.employeeIds };
    }

    if (filters.teamIds?.length) {
      where.reportingManagerId = { [Op.in]: filters.teamIds };
    }

    if (!filters.employeeIds?.length && !filters.teamIds?.length) {
      return undefined;
    }

    const users = await db.User.findAll({
      attributes: ['id'],
      where,
      raw: true,
    });

    return users.map((user: any) => Number(user.id)).filter((userId) => Number.isInteger(userId) && userId > 0);
  }

  public async getKpiCounts(scope: DashboardAggregateScope): Promise<DashboardKpiCounts> {
    console.log('############ Getting KPI counts for scope:', scope);
    const [totalEmployees, presentToday, onLeaveToday, totalVisits, orderCounts, paymentCounts, pendingDayovers] = await Promise.all([
      this.getTotalEmployees(scope.hostId, scope.filters.employeeIds),
      this.getPresentCount(scope.hostId, scope.todayRange, scope.filters.employeeIds),
      this.getOnLeaveCount(scope.hostId, scope.todayRange.startDate, scope.filters.employeeIds),
      this.getVisitCounts(scope).then((result) => result.totalVisits),
      this.getOrderCounts(scope),
      this.getPaymentCounts(scope),
      this.getPendingDayovers(scope.hostId, scope.todayRange, scope.filters.employeeIds),
    ]);

    return {
      totalEmployees,
      presentToday,
      onLeaveToday,
      totalVisits,
      totalOrders: orderCounts.totalOrders,
      totalPaymentAmount: paymentCounts.totalPaymentAmount,
      pendingDayovers,
    };
  }

  public async getTotalEmployees(hostId: number, employeeIds?: number[]): Promise<number> {
    return db.User.count({
      where: {
        hostId,
        isDeleted: 0,
        accountStatus: 'ACTIVE',
        ...(employeeIds !== undefined ? { id: { [Op.in]: employeeIds } } : {}),
      },
    });
  }

  public async getPresentCount(hostId: number, range: DashboardResolvedDateRange, employeeIds?: number[]): Promise<number> {
    return db.Attendance.count({
      distinct: true,
      col: 'userId',
      where: {
        hostId,
        isDeleted: 0,
        attendanceStatus: 'Present',
        attendanceTime: { [Op.between]: [range.startUnix, range.endUnix] },
        ...(employeeIds !== undefined ? { userId: { [Op.in]: employeeIds } } : {}),
      },
    });
  }

  public async getOnLeaveCount(hostId: number, leaveDate: string, employeeIds?: number[]): Promise<number> {
    return db.LeaveRequestDay.count({
      distinct: true,
      col: 'userId',
      where: {
        hostId,
        leaveDate,
        ...(employeeIds !== undefined ? { userId: { [Op.in]: employeeIds } } : {}),
      },
      include: [{
        model: db.LeaveRequest,
        as: 'leaveRequest',
        required: true,
        attributes: [],
        where: {
          hostId,
          status: 'APPROVED',
          isDeleted: 0,
        },
      }],
    });
  }

  public async getVisitCounts(scope: DashboardAggregateScope): Promise<DashboardVisitCounts> {
    const where = this.buildTimestampWhere(scope, 'checkInTime');
    const [totalVisits, completed, inProgress] = await Promise.all([
      db.Visit.count({ where }),
      db.Visit.count({ where: { ...where, checkOutTime: { [Op.not]: null } } }),
      db.Visit.count({ where: { ...where, checkOutTime: null } }),
    ]);

    return { totalVisits, completed, inProgress };
  }

  public async getOrderCounts(scope: DashboardAggregateScope): Promise<DashboardOrderCounts> {
    const row = await db.Order.findOne({
      attributes: [
        [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'totalOrders'],
        [db.Sequelize.fn('SUM', db.Sequelize.col('totalAmount')), 'totalOrderAmount'],
      ],
      where: this.buildTimestampWhere(scope, 'orderTime'),
      raw: true,
    });

    return {
      totalOrders: this.toNumber((row as any)?.totalOrders),
      totalOrderAmount: this.toNumber((row as any)?.totalOrderAmount),
    };
  }

  public async getPaymentCounts(scope: DashboardAggregateScope): Promise<DashboardPaymentCounts> {
    const row = await db.Payment.findOne({
      attributes: [
        [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'totalPayments'],
        [db.Sequelize.fn('SUM', db.Sequelize.col('amount')), 'totalPaymentAmount'],
      ],
      where: this.buildTimestampWhere(scope, 'paymentDate'),
      raw: true,
    });

    return {
      totalPayments: this.toNumber((row as any)?.totalPayments),
      totalPaymentAmount: this.toNumber((row as any)?.totalPaymentAmount),
    };
  }

  public async getFeedbackCounts(scope: DashboardAggregateScope): Promise<DashboardFeedbackCounts> {
    const totalFeedback = await db.Feedback.count({ where: this.buildTimestampWhere(scope, 'feedbackTime') });
    return { totalFeedback };
  }

  public async getImageCounts(scope: DashboardAggregateScope): Promise<DashboardImageCounts> {
    const totalUploaded = await db.Image.count({ where: this.buildTimestampWhere(scope, 'capturedAt') });
    return { totalUploaded };
  }

  public async getDayoverCounts(scope: DashboardAggregateScope, totalEmployees: number, onLeaveToday: number): Promise<DashboardDayoverCounts> {
    const [completed, pending] = await Promise.all([
      this.getCompletedDayovers(scope.hostId, scope.todayRange, scope.filters.employeeIds),
      this.getPendingDayovers(scope.hostId, scope.todayRange, scope.filters.employeeIds),
    ]);

    return {
      completed,
      pending,
      missing: Math.max(totalEmployees - completed - pending - onLeaveToday, 0),
    };
  }

  public async getSummaryTrend(scope: DashboardAggregateScope): Promise<DashboardTrendPoint[]> {
    const dateExpression = scope.granularity === 'month'
      ? "FROM_UNIXTIME(reportDate, '%Y-%m-01')"
      : 'reportDate';
    const rows = await db.sequelize.query(
      `SELECT ${dateExpression} AS bucketDate,
        COUNT(DISTINCT CASE WHEN attendanceStatus = 'Present' THEN userId END) AS present,
        COALESCE(SUM(totalVisits), 0) AS totalVisits,
        COALESCE(SUM(totalOrders), 0) AS totalOrders,
        COALESCE(SUM(orderAmount), 0) AS totalOrderAmount,
        COALESCE(SUM(totalPayments), 0) AS totalPayments,
        COALESCE(SUM(paymentAmount), 0) AS totalPaymentAmount,
        COALESCE(SUM(totalFeedbacks), 0) AS totalFeedback,
        COALESCE(SUM(totalImages), 0) AS totalUploaded
      FROM wd_user_daily_summary
      WHERE hostId = :hostId
        AND isDeleted = 0
        AND reportDate BETWEEN :startUnix AND :endUnix
        ${this.buildEmployeeSqlClause(scope.filters.employeeIds, 'userId')}
      GROUP BY bucketDate
      ORDER BY bucketDate ASC`,
      {
        replacements: {
          hostId: scope.hostId,
          startUnix: scope.range.startUnix,
          endUnix: scope.range.endUnix,
          employeeIds: scope.filters.employeeIds,
        },
        type: QueryTypes.SELECT,
      },
    ) as SummaryTrendRow[];

    return rows.map((row) => ({
      date: this.formatTrendDate(row.bucketDate, scope.granularity, scope.range.timezone),
      present: this.toNumber(row.present),
      totalVisits: this.toNumber(row.totalVisits),
      totalOrders: this.toNumber(row.totalOrders),
      totalOrderAmount: this.toNumber(row.totalOrderAmount),
      totalPayments: this.toNumber(row.totalPayments),
      totalPaymentAmount: this.toNumber(row.totalPaymentAmount),
      totalFeedback: this.toNumber(row.totalFeedback),
      totalUploaded: this.toNumber(row.totalUploaded),
    }));
  }

  public async getLeaveTrend(scope: DashboardAggregateScope): Promise<Map<string, number>> {
    const dateExpression = scope.granularity === 'month'
      ? "DATE_FORMAT(lrd.leaveDate, '%Y-%m')"
      : 'lrd.leaveDate';
    const rows = await db.sequelize.query(
      `SELECT ${dateExpression} AS leaveDate, COUNT(DISTINCT lrd.userId) AS onLeave
      FROM wd_leave_request_days lrd
      INNER JOIN wd_leave_requests lr ON lr.id = lrd.leaveRequestId
        AND lr.hostId = lrd.hostId
        AND lr.status = 'APPROVED'
        AND lr.isDeleted = 0
      WHERE lrd.hostId = :hostId
        AND lrd.leaveDate BETWEEN :startDate AND :endDate
        ${this.buildEmployeeSqlClause(scope.filters.employeeIds, 'lrd.userId')}
      GROUP BY leaveDate`,
      {
        replacements: {
          hostId: scope.hostId,
          startDate: scope.range.startDate,
          endDate: scope.range.endDate,
          employeeIds: scope.filters.employeeIds,
        },
        type: QueryTypes.SELECT,
      },
    ) as LeaveTrendRow[];

    return new Map(rows.map((row) => [row.leaveDate, this.toNumber(row.onLeave)]));
  }

  private async getCompletedDayovers(hostId: number, range: DashboardResolvedDateRange, employeeIds?: number[]): Promise<number> {
    return db.Attendance.count({
      distinct: true,
      col: 'userId',
      where: {
        hostId,
        isDeleted: 0,
        attendanceTime: { [Op.between]: [range.startUnix, range.endUnix] },
        dayoverTime: { [Op.not]: null },
        ...(employeeIds !== undefined ? { userId: { [Op.in]: employeeIds } } : {}),
      },
    });
  }

  private async getPendingDayovers(hostId: number, range: DashboardResolvedDateRange, employeeIds?: number[]): Promise<number> {
    return db.Attendance.count({
      distinct: true,
      col: 'userId',
      where: {
        hostId,
        isDeleted: 0,
        attendanceStatus: 'Present',
        attendanceTime: { [Op.between]: [range.startUnix, range.endUnix] },
        dayoverTime: null,
        ...(employeeIds !== undefined ? { userId: { [Op.in]: employeeIds } } : {}),
      },
    });
  }

  private buildTimestampWhere(scope: DashboardAggregateScope, timestampField: string): Record<string, unknown> {
    return {
      hostId: scope.hostId,
      isDeleted: 0,
      [timestampField]: { [Op.between]: [scope.range.startUnix, scope.range.endUnix] },
      ...(scope.filters.employeeIds !== undefined ? { userId: { [Op.in]: scope.filters.employeeIds } } : {}),
    };
  }

  private buildEmployeeSqlClause(employeeIds: number[] | undefined, columnName: string): string {
    if (employeeIds === undefined) {
      return '';
    }

    return employeeIds.length ? `AND ${columnName} IN (:employeeIds)` : `AND ${columnName} IN (NULL)`;
  }

  private toNumber(value: unknown): number {
    const numberValue = Number(value ?? 0);
    return Number.isFinite(numberValue) ? numberValue : 0;
  }

  private formatTrendDate(value: number | string, granularity: DashboardTrendGranularity, timezone: string): string {
    if (granularity === 'month') {
      return String(value).slice(0, 7);
    }

    const unix = this.toNumber(value);
    if (unix > 0) {
      return moment.unix(unix).tz(timezone).format('YYYY-MM-DD');
    }

    return String(value).slice(0, 10);
  }
}

export default new DashboardOverviewRepository();