import moment from 'moment-timezone';
import dashboardConfig from '../../../config/dashboard';
import performanceInsightRepository from '../../ai-insights/repositories/performance-insight.repository';
import reportService from '../../reporting/services/report.service';
import { cache, buildTenantCacheKey, type CacheServiceContract } from '../../../shared/cache';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { getHostDateTimeSettings } from '../../../shared/utils/host-settings.util';
import dashboardOverviewRepository, { DashboardOverviewRepository } from '../repositories/dashboard-overview.repository';
import dashboardCacheInvalidationService from './dashboard-cache-invalidation.service';
import type {
  DashboardDateFilter,
  DashboardOverviewContext,
  DashboardOverviewRequest,
  DashboardOverviewResponse,
  DashboardResolvedDateRange,
  DashboardResolvedFilters,
  DashboardTrendGranularity,
  DashboardTrendPoint,
} from '../types/dashboard.types';

const MAX_CUSTOM_RANGE_DAYS = 366;

interface ResolvedDashboardRequest {
  range: DashboardResolvedDateRange;
  todayRange: DashboardResolvedDateRange;
  filters: DashboardResolvedFilters;
  granularity: DashboardTrendGranularity;
  topPerformersLimit: number;
  activityLimit: number;
  includeActivity: boolean;
  cacheVersion: number;
  cacheKey: string;
  ttlSeconds: number;
}

interface DashboardPerformanceParams {
  hostId: number;
  startDateTime: string;
  endDateTime: string;
  employeeIds?: number[];
  limit?: number;
}

interface DashboardPerformanceReader {
  getBestPerformers(params: DashboardPerformanceParams): Promise<unknown[]>;
  getTopVisitPerformers(params: DashboardPerformanceParams): Promise<unknown[]>;
  getTopOrderPerformers(params: DashboardPerformanceParams): Promise<unknown[]>;
  getTopPaymentPerformers(params: DashboardPerformanceParams): Promise<unknown[]>;
}

interface DashboardReportReader {
  getAllActivitiesReport(payload: Record<string, unknown>): Promise<{ activities: unknown[] }>;
}

interface DashboardVersionReader {
  getOverviewVersion(hostId: number): Promise<number>;
}

interface DashboardDateTimeSettingsReader {
  (hostId: number): Promise<{ timeZone: string }>;
}

export class DashboardService {
  public constructor(
    private readonly repository: DashboardOverviewRepository = dashboardOverviewRepository,
    private readonly cacheService: CacheServiceContract = cache,
    private readonly performanceRepository: DashboardPerformanceReader = performanceInsightRepository,
    private readonly reportingService: DashboardReportReader = reportService,
    private readonly cacheVersionReader: DashboardVersionReader = dashboardCacheInvalidationService,
    private readonly dateTimeSettingsReader: DashboardDateTimeSettingsReader = getHostDateTimeSettings,
  ) {}

  public async getOverview(context: DashboardOverviewContext): Promise<DashboardOverviewResponse> {
    const resolved = await this.resolveRequest(context);

    const result = await this.cacheService.getOrSetWithLockResult(
      resolved.cacheKey,
      () => this.buildOverview(context.hostId, resolved),
      resolved.ttlSeconds,
      { lockTtlSeconds: 10, waitTimeoutMs: 2000, retryDelayMs: 100 },
    );

    return this.withCacheMetadata(result.value, result.hit);
  }

  private async buildOverview(hostId: number, resolved: ResolvedDashboardRequest): Promise<DashboardOverviewResponse> {
    const scope = {
      hostId,
      range: resolved.range,
      todayRange: resolved.todayRange,
      filters: resolved.filters,
      granularity: resolved.granularity,
    };
    
    const [kpis, visitCounts, orderCounts, paymentCounts, feedbackCounts, imageCounts, summaryTrendRows, leaveTrend, performance, activity] = await Promise.all([
      this.repository.getKpiCounts(scope),
      this.repository.getVisitCounts(scope),
      this.repository.getOrderCounts(scope),
      this.repository.getPaymentCounts(scope),
      this.repository.getFeedbackCounts(scope),
      this.repository.getImageCounts(scope),
      this.repository.getSummaryTrend(scope),
      this.repository.getLeaveTrend(scope),
      this.getPerformance(hostId, resolved),
      resolved.includeActivity ? this.getActivity(hostId, resolved) : Promise.resolve(undefined),
    ]);
    const totalEmployees = kpis.totalEmployees;
    const attendancePercentage = this.calculatePercentage(kpis.presentToday, totalEmployees);
    const dayover = await this.repository.getDayoverCounts(scope, totalEmployees, kpis.onLeaveToday);
    const trendRows = this.fillTrendRows(summaryTrendRows, resolved);
    const attendanceTrend = this.buildAttendanceTrend(trendRows, leaveTrend, totalEmployees, resolved);

    return {
      meta: {
        hostId,
        timezone: resolved.range.timezone,
        range: {
          preset: resolved.range.preset,
          startDate: resolved.range.startDate,
          endDate: resolved.range.endDate,
          startTime: resolved.range.startUnix,
          endTime: resolved.range.endUnix,
          granularity: resolved.granularity,
        },
        generatedAt: moment().unix(),
        cache: {
          key: resolved.cacheKey,
          ttlSeconds: resolved.ttlSeconds,
          hit: false,
          source: 'database',
        },
        filters: resolved.filters,
      },
      kpis: {
        totalEmployees,
        presentToday: kpis.presentToday,
        attendancePercentage,
        totalVisits: kpis.totalVisits,
        totalOrders: kpis.totalOrders,
        totalPaymentAmount: this.roundMoney(kpis.totalPaymentAmount),
        pendingDayovers: kpis.pendingDayovers,
      },
      attendance: {
        present: kpis.presentToday,
        absent: Math.max(totalEmployees - kpis.presentToday - kpis.onLeaveToday, 0),
        onLeave: kpis.onLeaveToday,
        dayoverPending: kpis.pendingDayovers,
        trend: attendanceTrend,
      },
      visits: {
        totalVisits: visitCounts.totalVisits,
        statusBreakdown: {
          available: true,
          items: [
            { status: 'completed', count: visitCounts.completed },
            { status: 'inProgress', count: visitCounts.inProgress },
          ],
        },
        trend: trendRows.map((row) => ({ date: row.date, totalVisits: row.totalVisits || 0 })),
      },
      orders: {
        totalOrders: orderCounts.totalOrders,
        statusBreakdown: {
          available: false,
          reason: 'Current order schema does not expose order status.',
        },
        trend: trendRows.map((row) => ({
          date: row.date,
          totalOrders: row.totalOrders || 0,
          totalOrderAmount: this.roundMoney(row.totalOrderAmount || 0),
        })),
      },
      payments: {
        totalAmount: this.roundMoney(paymentCounts.totalPaymentAmount),
        received: this.roundMoney(paymentCounts.totalPaymentAmount),
        pending: null,
        failed: null,
        statusBreakdown: {
          available: false,
          reason: 'Current payment schema does not expose payment status.',
        },
        trend: trendRows.map((row) => ({
          date: row.date,
          totalPayments: row.totalPayments || 0,
          totalPaymentAmount: this.roundMoney(row.totalPaymentAmount || 0),
        })),
      },
      feedback: {
        totalFeedback: feedbackCounts.totalFeedback,
        ratingBreakdown: {
          available: false,
          reason: 'Current feedback schema does not expose rating/status.',
        },
        trend: trendRows.map((row) => ({ date: row.date, totalFeedback: row.totalFeedback || 0 })),
      },
      images: {
        totalUploaded: imageCounts.totalUploaded,
        trend: trendRows.map((row) => ({ date: row.date, totalUploaded: row.totalUploaded || 0 })),
      },
      dayover,
      performance,
      ...(activity ? { activity } : {}),
    };
  }

  private async resolveRequest(context: DashboardOverviewContext): Promise<ResolvedDashboardRequest> {
    const settings = await this.dateTimeSettingsReader(context.hostId);
    const timezone = moment.tz.zone(settings.timeZone) ? settings.timeZone : 'Asia/Kolkata';
    const range = this.resolveDateRange(context.request, timezone);
    const todayRange = this.resolvePresetRange('today', timezone);
    const inputFilters = this.normalizeFilters(context.request.filter);
    const scopedEmployeeIds = await this.repository.resolveScopedEmployeeIds(context.hostId, inputFilters);
    const filters: DashboardResolvedFilters = {
      ...inputFilters,
      employeeIds: scopedEmployeeIds === undefined ? undefined : scopedEmployeeIds,
    };
    const granularity = context.request.options?.trendGranularity || this.defaultGranularity(range);
    const ttlSeconds = this.isTodayRange(range, todayRange) ? dashboardConfig.overviewTodayTtl : dashboardConfig.overviewRangeTtl;
    const topPerformersLimit = context.request.options?.topPerformersLimit || 5;
    const activityLimit = context.request.options?.activityLimit || 10;
    const includeActivity = context.request.options?.includeActivity !== false;
    const cacheVersion = await this.cacheVersionReader.getOverviewVersion(context.hostId);
    const cacheKey = this.buildCacheKey(context.hostId, range, filters, granularity, topPerformersLimit, activityLimit, includeActivity, cacheVersion);

    return {
      range,
      todayRange,
      filters,
      granularity,
      topPerformersLimit,
      activityLimit,
      includeActivity,
      cacheVersion,
      cacheKey,
      ttlSeconds,
    };
  }

  private async getPerformance(hostId: number, resolved: ResolvedDashboardRequest): Promise<DashboardOverviewResponse['performance']> {
    if (resolved.filters.employeeIds !== undefined && resolved.filters.employeeIds.length === 0) {
      return {
        overall: [],
        byVisits: [],
        byOrders: [],
        byPayments: [],
      };
    }

    const params = {
      hostId,
      startDateTime: resolved.range.startDateTime,
      endDateTime: resolved.range.endDateTime,
      employeeIds: resolved.filters.employeeIds,
      limit: resolved.topPerformersLimit,
    };
    const [overall, byVisits, byOrders, byPayments] = await Promise.all([
      this.performanceRepository.getBestPerformers(params),
      this.performanceRepository.getTopVisitPerformers(params),
      this.performanceRepository.getTopOrderPerformers(params),
      this.performanceRepository.getTopPaymentPerformers(params),
    ]);

    return { overall, byVisits, byOrders, byPayments };
  }

  private async getActivity(hostId: number, resolved: ResolvedDashboardRequest): Promise<DashboardOverviewResponse['activity']> {
    if (resolved.filters.employeeIds !== undefined && resolved.filters.employeeIds.length === 0) {
      return {
        items: [],
      };
    }

    const result = await this.reportingService.getAllActivitiesReport({
      hostId,
      page: 1,
      limit: resolved.activityLimit,
      filter: {
        activityTime: {
          from: resolved.range.startUnix,
          to: resolved.range.endUnix,
        },
        ...(resolved.filters.employeeIds?.length === 1 ? { userId: resolved.filters.employeeIds[0] } : {}),
      },
    });

    return {
      items: result.activities,
    };
  }

  private normalizeFilters(filter: DashboardOverviewRequest['filter']): DashboardResolvedFilters {
    const employeeIds = this.uniqueNumbers([
      ...(filter?.employees?.ids || []),
      ...(filter?.users?.ids || []),
      ...(filter?.employeeIds || []),
      ...(filter?.userIds || []),
      ...(filter?.userId ? [filter.userId] : []),
    ]);
    const teamIds = this.uniqueNumbers([
      ...(filter?.teams?.ids || []),
      ...(filter?.teamIds || []),
    ]);

    return {
      ...(employeeIds.length ? { employeeIds } : {}),
      ...(teamIds.length ? { teamIds } : {}),
    };
  }

  private resolveDateRange(request: DashboardOverviewRequest, timezone: string): DashboardResolvedDateRange {
    const createdAt = request.filter?.createdAt;
    if (createdAt?.from && createdAt?.to) {
      if (createdAt.from > createdAt.to) {
        throw createConfiguredError('VALIDATION_ERROR', 'createdAt.from cannot be greater than createdAt.to', 400, 'VALIDATION_ERROR');
      }

      return this.createRange(moment.unix(createdAt.from).tz(timezone), moment.unix(createdAt.to).tz(timezone), timezone, 'unix_range');
    }

    const dateFilter = request.filter?.date || { type: 'preset', value: 'today' } as DashboardDateFilter;
    if (dateFilter.type === 'custom') {
      const start = moment.tz(dateFilter.startDate, 'YYYY-MM-DD', true, timezone).startOf('day');
      const end = moment.tz(dateFilter.endDate, 'YYYY-MM-DD', true, timezone).endOf('day');
      if (!start.isValid() || !end.isValid()) {
        throw createConfiguredError('VALIDATION_ERROR', 'Invalid custom date range', 400, 'VALIDATION_ERROR');
      }

      const rangeDays = end.diff(start, 'days') + 1;
      if (rangeDays > MAX_CUSTOM_RANGE_DAYS) {
        throw createConfiguredError('VALIDATION_ERROR', `Custom date range cannot exceed ${MAX_CUSTOM_RANGE_DAYS} days`, 400, 'VALIDATION_ERROR');
      }

      return this.createRange(start, end, timezone, 'custom');
    }

    return this.resolvePresetRange(dateFilter.value || 'today', timezone);
  }

  private resolvePresetRange(preset: NonNullable<DashboardDateFilter['value']>, timezone: string): DashboardResolvedDateRange {
    const now = moment().tz(timezone);
    let start = now.clone();
    let end = now.clone();

    switch (preset) {
      case 'today':
        start = now.clone().startOf('day');
        end = now.clone().endOf('day');
        break;
      case 'yesterday':
        start = now.clone().subtract(1, 'day').startOf('day');
        end = now.clone().subtract(1, 'day').endOf('day');
        break;
      case 'this_week':
        start = now.clone().startOf('week');
        end = now.clone().endOf('day');
        break;
      case 'last_week':
        start = now.clone().subtract(1, 'week').startOf('week');
        end = now.clone().subtract(1, 'week').endOf('week');
        break;
      case 'this_month':
        start = now.clone().startOf('month');
        end = now.clone().endOf('day');
        break;
      case 'last_month':
        start = now.clone().subtract(1, 'month').startOf('month');
        end = now.clone().subtract(1, 'month').endOf('month');
        break;
    }

    return this.createRange(start, end, timezone, preset);
  }

  private createRange(start: moment.Moment, end: moment.Moment, timezone: string, preset: DashboardResolvedDateRange['preset']): DashboardResolvedDateRange {
    return {
      preset,
      startDate: start.format('YYYY-MM-DD'),
      endDate: end.format('YYYY-MM-DD'),
      startUnix: start.unix(),
      endUnix: end.unix(),
      startDateTime: start.toISOString(),
      endDateTime: end.toISOString(),
      timezone,
    };
  }

  private buildAttendanceTrend(
    trendRows: DashboardTrendPoint[],
    leaveTrend: Map<string, number>,
    totalEmployees: number,
    resolved: ResolvedDashboardRequest,
  ): DashboardTrendPoint[] {
    return trendRows.map((row) => {
      const onLeave = leaveTrend.get(row.date) || 0;
      const present = row.present || 0;
      const absent = Math.max(totalEmployees - present - onLeave, 0);

      return {
        date: row.date,
        present,
        absent,
        onLeave,
        attendancePercentage: this.calculatePercentage(present, totalEmployees),
      };
    });
  }

  private fillTrendRows(rows: DashboardTrendPoint[], resolved: ResolvedDashboardRequest): DashboardTrendPoint[] {
    const byDate = new Map(rows.map((row) => [row.date, row]));
    const buckets = this.buildTrendBuckets(resolved.range, resolved.granularity);

    return buckets.map((date) => ({
      date,
      present: byDate.get(date)?.present || 0,
      totalVisits: byDate.get(date)?.totalVisits || 0,
      totalOrders: byDate.get(date)?.totalOrders || 0,
      totalOrderAmount: byDate.get(date)?.totalOrderAmount || 0,
      totalPayments: byDate.get(date)?.totalPayments || 0,
      totalPaymentAmount: byDate.get(date)?.totalPaymentAmount || 0,
      totalFeedback: byDate.get(date)?.totalFeedback || 0,
      totalUploaded: byDate.get(date)?.totalUploaded || 0,
    }));
  }

  private buildTrendBuckets(range: DashboardResolvedDateRange, granularity: DashboardTrendGranularity): string[] {
    const buckets: string[] = [];
    const unit = granularity === 'month' ? 'month' : 'day';
    const format = granularity === 'month' ? 'YYYY-MM' : 'YYYY-MM-DD';
    const cursor = moment.tz(range.startDate, 'YYYY-MM-DD', range.timezone).startOf(unit);
    const end = moment.tz(range.endDate, 'YYYY-MM-DD', range.timezone).startOf(unit);

    while (cursor.isSameOrBefore(end)) {
      buckets.push(cursor.format(format));
      cursor.add(1, unit);
    }

    return buckets;
  }

  private buildCacheKey(
    hostId: number,
    range: DashboardResolvedDateRange,
    filters: DashboardResolvedFilters,
    granularity: DashboardTrendGranularity,
    topPerformersLimit: number,
    activityLimit: number,
    includeActivity: boolean,
    cacheVersion: number,
  ): string {
    return buildTenantCacheKey({
      version: 'v1',
      module: 'dashboard',
      resource: 'overview',
      hostId,
      date: `${range.startDate}_${range.endDate}`,
      scope: [granularity, `cache-${cacheVersion}`, `performers-${topPerformersLimit}`, `activity-${includeActivity ? activityLimit : 'off'}`],
      identifier: [
        `employees-${this.formatKeyList(filters.employeeIds)}`,
        `teams-${this.formatKeyList(filters.teamIds)}`,
      ],
    });
  }

  private defaultGranularity(range: DashboardResolvedDateRange): DashboardTrendGranularity {
    const days = moment.unix(range.endUnix).diff(moment.unix(range.startUnix), 'days') + 1;
    return days > 62 ? 'month' : 'day';
  }

  private isTodayRange(range: DashboardResolvedDateRange, todayRange: DashboardResolvedDateRange): boolean {
    return range.startDate === todayRange.startDate && range.endDate === todayRange.endDate;
  }

  private calculatePercentage(value: number, total: number): number {
    if (total <= 0) {
      return 0;
    }

    return Number(((value / total) * 100).toFixed(2));
  }

  private roundMoney(value: number): number {
    return Number(Number(value || 0).toFixed(2));
  }

  private uniqueNumbers(values: number[]): number[] {
    return Array.from(new Set(values.filter((value) => Number.isInteger(value) && value > 0))).sort((a, b) => a - b);
  }

  private formatKeyList(values?: number[]): string {
    return values?.length ? values.join('.') : 'all';
  }

  private withCacheMetadata(response: DashboardOverviewResponse, hit: boolean): DashboardOverviewResponse {
    return {
      ...response,
      meta: {
        ...response.meta,
        cache: {
          ...response.meta.cache,
          hit,
          source: hit ? 'cache' : 'database',
        },
      },
    };
  }
}

export default new DashboardService();