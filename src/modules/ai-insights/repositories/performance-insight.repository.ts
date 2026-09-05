import { Op } from 'sequelize';
import db from '../../../models';
import { AiInsightBaseQueryParams, AiInsightResultItem } from '../types/ai-insights.types';
import { DEFAULT_PERFORMANCE_WEIGHTS } from '../constants/performance.constants';
import { calculatePerformanceScore } from '../helpers/performance-score.helper';

interface PerformanceInsightParams extends AiInsightBaseQueryParams {}

type NumericMap = Map<number, number>;

interface Range {
  startUnix: number;
  endUnix: number;
}

export class PerformanceInsightRepository {
  private toUnixRange(params: PerformanceInsightParams): Range {
    return {
      startUnix: Math.floor(new Date(params.startDateTime).getTime() / 1000),
      endUnix: Math.floor(new Date(params.endDateTime).getTime() / 1000),
    };
  }

  private getPreviousRange(current: Range): Range {
    const duration = current.endUnix - current.startUnix;
    return {
      startUnix: current.startUnix - duration - 1,
      endUnix: current.startUnix - 1,
    };
  }

  private async getUsersByHost(
    hostId: number,
    employeeIds?: number[]
  ): Promise<Map<number, { name: string; employeeCode?: string }>> {
    const where: any = {
      hostId,
      isDeleted: 0,
      isFieldAppUser: 1,
    };

    if (employeeIds?.length) {
      where.id = {
        [Op.in]: employeeIds,
      };
    }

    const users = await db.User.findAll({
      where,
      attributes: ['id', 'name', 'employeeCode'],
      raw: true,
    });

    const map = new Map<number, { name: string; employeeCode?: string }>();
    users.forEach((u: any) => {
      map.set(Number(u.id), {
        name: u.name || 'Unknown',
        employeeCode: u.employeeCode || undefined,
      });
    });

    return map;
  }

  private async getVisitCounts(
    hostId: number,
    range: Range,
    employeeIds?: number[]
  ): Promise<NumericMap> {
    const where: any = {
      hostId,
      isDeleted: 0,
      checkInTime: {
        [Op.gte]: range.startUnix,
        [Op.lte]: range.endUnix,
      },
    };

    if (employeeIds?.length) {
      where.userId = { [Op.in]: employeeIds };
    }

    const rows = await db.Visit.findAll({
      attributes: ['userId', [db.Sequelize.fn('COUNT', db.Sequelize.col('id')), 'value']],
      where,
      group: ['userId'],
      raw: true,
    });

    const result: NumericMap = new Map();
    rows.forEach((row: any) => {
      result.set(Number(row.userId), Number(row.value || 0));
    });

    return result;
  }

  private async getOrderValues(
    hostId: number,
    range: Range,
    employeeIds?: number[]
  ): Promise<NumericMap> {
    const where: any = {
      hostId,
      isDeleted: 0,
      orderTime: {
        [Op.gte]: range.startUnix,
        [Op.lte]: range.endUnix,
      },
    };

    if (employeeIds?.length) {
      where.userId = { [Op.in]: employeeIds };
    }

    const rows = await db.Order.findAll({
      attributes: ['userId', [db.Sequelize.fn('SUM', db.Sequelize.col('totalAmount')), 'value']],
      where,
      group: ['userId'],
      raw: true,
    });

    const result: NumericMap = new Map();
    rows.forEach((row: any) => {
      result.set(Number(row.userId), Number(row.value || 0));
    });

    return result;
  }

  private async getPaymentValues(
    hostId: number,
    range: Range,
    employeeIds?: number[]
  ): Promise<NumericMap> {
    const where: any = {
      hostId,
      isDeleted: 0,
      paymentDate: {
        [Op.gte]: range.startUnix,
        [Op.lte]: range.endUnix,
      },
    };

    if (employeeIds?.length) {
      where.userId = { [Op.in]: employeeIds };
    }

    const rows = await db.Payment.findAll({
      attributes: ['userId', [db.Sequelize.fn('SUM', db.Sequelize.col('amount')), 'value']],
      where,
      group: ['userId'],
      raw: true,
    });

    const result: NumericMap = new Map();
    rows.forEach((row: any) => {
      result.set(Number(row.userId), Number(row.value || 0));
    });

    return result;
  }

  private async getPresentDayCounts(
    hostId: number,
    range: Range,
    employeeIds?: number[]
  ): Promise<NumericMap> {
    const where: any = {
      hostId,
      isDeleted: 0,
      attendanceStatus: 'Present',
      reportDate: {
        [Op.gte]: range.startUnix,
        [Op.lte]: range.endUnix,
      },
    };

    if (employeeIds?.length) {
      where.userId = { [Op.in]: employeeIds };
    }

    const rows = await db.UserDailySummary.findAll({
      attributes: [
        'userId',
        [
          db.Sequelize.fn('COUNT', db.Sequelize.fn('DISTINCT', db.Sequelize.col('reportDate'))),
          'value',
        ],
      ],
      where,
      group: ['userId'],
      raw: true,
    });

    const result: NumericMap = new Map();
    rows.forEach((row: any) => {
      result.set(Number(row.userId), Number(row.value || 0));
    });

    return result;
  }

  private async getPerformanceRankings(
    params: PerformanceInsightParams,
    direction: 'asc' | 'desc'
  ): Promise<AiInsightResultItem[]> {
    const range = this.toUnixRange(params);
    const limit = params.limit ?? 5;

    const [users, visits, orders, payments, presentDays] = await Promise.all([
      this.getUsersByHost(params.hostId, params.employeeIds),
      this.getVisitCounts(params.hostId, range, params.employeeIds),
      this.getOrderValues(params.hostId, range, params.employeeIds),
      this.getPaymentValues(params.hostId, range, params.employeeIds),
      this.getPresentDayCounts(params.hostId, range, params.employeeIds),
    ]);

    const candidates: Array<{
      userId: number;
      name: string;
      employeeCode?: string;
      totalVisits: number;
      totalOrderValue: number;
      totalPaymentValue: number;
      presentDays: number;
    }> = [];

    users.forEach((user, userId) => {
      const visitCount = visits.get(userId) || 0;
      const orderValue = orders.get(userId) || 0;
      const paymentValue = payments.get(userId) || 0;
      const employeePresentDays = presentDays.get(userId) || 0;

      if (visitCount === 0 && orderValue === 0 && paymentValue === 0) {
        return;
      }

      candidates.push({
        userId,
        name: user.name,
        employeeCode: user.employeeCode,
        totalVisits: visitCount,
        totalOrderValue: orderValue,
        totalPaymentValue: paymentValue,
        presentDays: employeePresentDays,
      });
    });

    const maxOrderValue = Math.max(0, ...candidates.map((candidate) => candidate.totalOrderValue));
    const maxPaymentValue = Math.max(
      0,
      ...candidates.map((candidate) => candidate.totalPaymentValue)
    );
    const maxPresentDays = Math.max(0, ...candidates.map((candidate) => candidate.presentDays));
    const maxVisits = Math.max(0, ...candidates.map((candidate) => candidate.totalVisits));
    const weights = DEFAULT_PERFORMANCE_WEIGHTS;
    const rows = candidates.map((candidate) => {
      const score = calculatePerformanceScore({
        totalOrderValue: candidate.totalOrderValue,
        totalPaymentValue: candidate.totalPaymentValue,
        totalVisits: candidate.totalVisits,
        presentDays: candidate.presentDays,
        maxOrderValue,
        maxPaymentValue,
        maxPresentDays,
        maxVisits,
        weights,
      });

      return {
        row: {
          employee: {
            id: candidate.userId,
            employeeCode: candidate.employeeCode,
            name: candidate.name,
          },
          score: score.score,
          metrics: {
            totalVisits: candidate.totalVisits,
            totalOrderValue: Number(candidate.totalOrderValue.toFixed(2)),
            totalPaymentValue: Number(candidate.totalPaymentValue.toFixed(2)),
            presentDays: candidate.presentDays,
            orderScore: score.orderScore,
            paymentScore: score.paymentScore,
            visitScore: score.visitScore,
            attendanceScore: score.attendanceScore,
          },
        },
        totalOrderValue: candidate.totalOrderValue,
        totalPaymentValue: candidate.totalPaymentValue,
        totalVisits: candidate.totalVisits,
        userId: candidate.userId,
      };
    });

    rows.sort((a, b) => {
      const scoreDifference = Number(a.row.score || 0) - Number(b.row.score || 0);
      if (scoreDifference !== 0) {
        return direction === 'desc' ? -scoreDifference : scoreDifference;
      }

      const orderDifference = a.totalOrderValue - b.totalOrderValue;
      if (orderDifference !== 0) {
        return direction === 'desc' ? -orderDifference : orderDifference;
      }

      const paymentDifference = a.totalPaymentValue - b.totalPaymentValue;
      if (paymentDifference !== 0) {
        return direction === 'desc' ? -paymentDifference : paymentDifference;
      }

      const visitDifference = a.totalVisits - b.totalVisits;
      if (visitDifference !== 0) {
        return direction === 'desc' ? -visitDifference : visitDifference;
      }

      return direction === 'desc' ? b.userId - a.userId : a.userId - b.userId;
    });

    return rows.slice(0, limit).map((item, index) => ({
      ...item.row,
      rank: index + 1,
    }));
  }

  async getBestPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
    return this.getPerformanceRankings(params, 'desc');
  }

  async getLowestPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
    return this.getPerformanceRankings(params, 'asc');
  }

  async getMostImproved(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
    const currentRange = this.toUnixRange(params);
    const previousRange = this.getPreviousRange(currentRange);
    const limit = params.limit ?? 5;

    const [
      users,
      currentVisits,
      currentOrders,
      currentPayments,
      previousVisits,
      previousOrders,
      previousPayments,
    ] = await Promise.all([
      this.getUsersByHost(params.hostId, params.employeeIds),
      this.getVisitCounts(params.hostId, currentRange, params.employeeIds),
      this.getOrderValues(params.hostId, currentRange, params.employeeIds),
      this.getPaymentValues(params.hostId, currentRange, params.employeeIds),
      this.getVisitCounts(params.hostId, previousRange, params.employeeIds),
      this.getOrderValues(params.hostId, previousRange, params.employeeIds),
      this.getPaymentValues(params.hostId, previousRange, params.employeeIds),
    ]);

    const currentRows = await this.getBestPerformers(params);
    const currentScores = new Map<number, number>();
    currentRows.forEach((row) => {
      if (row.employee?.id) {
        currentScores.set(row.employee.id, Number(row.score || 0));
      }
    });

    const previousParams: PerformanceInsightParams = {
      ...params,
      startDateTime: new Date(previousRange.startUnix * 1000).toISOString(),
      endDateTime: new Date(previousRange.endUnix * 1000).toISOString(),
    };
    const previousRows = await this.getBestPerformers(previousParams);
    const previousScores = new Map<number, number>();
    previousRows.forEach((row) => {
      if (row.employee?.id) {
        previousScores.set(row.employee.id, Number(row.score || 0));
      }
    });

    const improvements: AiInsightResultItem[] = [];

    users.forEach((user, userId) => {
      const currentScore = currentScores.get(userId) || 0;
      const previousScore = previousScores.get(userId) || 0;
      const currentOrder = currentOrders.get(userId) || 0;
      const previousOrder = previousOrders.get(userId) || 0;
      const currentPayment = currentPayments.get(userId) || 0;
      const previousPayment = previousPayments.get(userId) || 0;
      const currentVisit = currentVisits.get(userId) || 0;
      const previousVisit = previousVisits.get(userId) || 0;

      const orderDelta = currentOrder - previousOrder;
      const paymentDelta = currentPayment - previousPayment;
      const visitDelta = currentVisit - previousVisit;
      const change = currentScore - previousScore;

      if (currentScore === 0 && previousScore === 0) {
        return;
      }

      const changePercentage =
        previousOrder > 0 ? (orderDelta / previousOrder) * 100 : orderDelta > 0 ? 100 : 0;

      improvements.push({
        employee: {
          id: userId,
          employeeCode: user.employeeCode,
          name: user.name,
        },
        score: Number(currentOrder.toFixed(2)),
        metrics: {
          totalVisits: currentVisit,
          totalOrderValue: Number(currentOrder.toFixed(2)),
          totalPaymentValue: Number(currentPayment.toFixed(2)),
          deltaVisits: visitDelta,
          deltaOrderValue: Number(orderDelta.toFixed(2)),
          deltaPaymentValue: Number(paymentDelta.toFixed(2)),
        },
        comparison: {
          previousPeriodScore: Number(previousOrder.toFixed(2)),
          change: Number(change.toFixed(2)),
          changePercentage: Number(changePercentage.toFixed(2)),
        },
      });
    });

    improvements.sort((a, b) => {
      const aOrderDelta = Number(a.metrics?.deltaOrderValue || 0);
      const bOrderDelta = Number(b.metrics?.deltaOrderValue || 0);
      if (bOrderDelta !== aOrderDelta) {
        return bOrderDelta - aOrderDelta;
      }

      const aPaymentDelta = Number(a.metrics?.deltaPaymentValue || 0);
      const bPaymentDelta = Number(b.metrics?.deltaPaymentValue || 0);
      if (bPaymentDelta !== aPaymentDelta) {
        return bPaymentDelta - aPaymentDelta;
      }

      const aVisitDelta = Number(a.metrics?.deltaVisits || 0);
      const bVisitDelta = Number(b.metrics?.deltaVisits || 0);
      return bVisitDelta - aVisitDelta;
    });

    return improvements.slice(0, limit).map((item, index) => ({
      ...item,
      rank: index + 1,
    }));
  }

  async getTopVisitPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
    const range = this.toUnixRange(params);
    const users = await this.getUsersByHost(params.hostId, params.employeeIds);
    const visitCounts = await this.getVisitCounts(params.hostId, range, params.employeeIds);

    const rows: AiInsightResultItem[] = [];
    users.forEach((user, userId) => {
      const count = visitCounts.get(userId) || 0;
      if (!count) {
        return;
      }

      rows.push({
        employee: {
          id: userId,
          employeeCode: user.employeeCode,
          name: user.name,
        },
        score: count,
        metrics: {
          totalVisits: count,
        },
      });
    });

    rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return rows.slice(0, params.limit ?? 5).map((row, index) => ({ ...row, rank: index + 1 }));
  }

  async getTopOrderPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
    const range = this.toUnixRange(params);
    const users = await this.getUsersByHost(params.hostId, params.employeeIds);
    const orderValues = await this.getOrderValues(params.hostId, range, params.employeeIds);

    const rows: AiInsightResultItem[] = [];
    users.forEach((user, userId) => {
      const value = orderValues.get(userId) || 0;
      if (!value) {
        return;
      }

      rows.push({
        employee: {
          id: userId,
          employeeCode: user.employeeCode,
          name: user.name,
        },
        score: Number(value.toFixed(2)),
        metrics: {
          totalOrderValue: Number(value.toFixed(2)),
        },
      });
    });

    rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return rows.slice(0, params.limit ?? 5).map((row, index) => ({ ...row, rank: index + 1 }));
  }

  async getTopPaymentPerformers(params: PerformanceInsightParams): Promise<AiInsightResultItem[]> {
    const range = this.toUnixRange(params);
    const users = await this.getUsersByHost(params.hostId, params.employeeIds);
    const paymentValues = await this.getPaymentValues(params.hostId, range, params.employeeIds);

    const rows: AiInsightResultItem[] = [];
    users.forEach((user, userId) => {
      const value = paymentValues.get(userId) || 0;
      if (!value) {
        return;
      }

      rows.push({
        employee: {
          id: userId,
          employeeCode: user.employeeCode,
          name: user.name,
        },
        score: Number(value.toFixed(2)),
        metrics: {
          totalPaymentValue: Number(value.toFixed(2)),
        },
      });
    });

    rows.sort((a, b) => Number(b.score || 0) - Number(a.score || 0));
    return rows.slice(0, params.limit ?? 5).map((row, index) => ({ ...row, rank: index + 1 }));
  }
}

export default new PerformanceInsightRepository();
