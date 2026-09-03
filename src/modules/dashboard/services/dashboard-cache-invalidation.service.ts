import dashboardConfig from '../../../config/dashboard';
import { logger } from '../../../config/database';
import { cache, buildTenantCacheKey, type CacheServiceContract } from '../../../shared/cache';

export type DashboardCacheInvalidationEvent =
  | 'attendance.changed'
  | 'dayover.changed'
  | 'visit.changed'
  | 'order.changed'
  | 'payment.changed'
  | 'feedback.changed'
  | 'image.changed'
  | 'leave.status_changed';

export interface DashboardCacheInvalidationPayload {
  hostId: number;
  event: DashboardCacheInvalidationEvent;
  occurredAt?: number | string | null;
  previousOccurredAt?: number | string | null;
}

export class DashboardCacheInvalidationService {
  public constructor(
    private readonly cacheService: CacheServiceContract = cache,
  ) {}

  public async getOverviewVersion(hostId: number): Promise<number> {
    const normalizedHostId = this.normalizeHostId(hostId);
    if (normalizedHostId === null) {
      return 0;
    }

    const version = await this.cacheService.get<number>(this.buildOverviewVersionKey(normalizedHostId));
    return Number.isFinite(Number(version)) ? Number(version) : 0;
  }

  public async invalidateOverview(payload: DashboardCacheInvalidationPayload): Promise<void> {
    const hostId = this.normalizeHostId(payload.hostId);
    if (hostId === null) {
      return;
    }

    try {
      const version = await this.cacheService.increment(this.buildOverviewVersionKey(hostId), dashboardConfig.overviewVersionTtl);
      if (version === null) {
        logger.warn('Dashboard overview cache invalidation skipped because cache increment failed.', {
          hostId,
          event: payload.event,
          occurredAt: payload.occurredAt ?? null,
          previousOccurredAt: payload.previousOccurredAt ?? null,
        });
        return;
      }

      logger.info('Dashboard overview cache invalidated.', {
        hostId,
        event: payload.event,
        version,
        occurredAt: payload.occurredAt ?? null,
        previousOccurredAt: payload.previousOccurredAt ?? null,
      });
    } catch (error: unknown) {
      logger.warn('Failed to invalidate dashboard overview cache.', {
        hostId,
        event: payload.event,
        error: error instanceof Error ? error.message : String(error),
      });
    }
  }

  private buildOverviewVersionKey(hostId: number): string {
    return buildTenantCacheKey({
      version: 'v1',
      module: 'dashboard',
      resource: 'overview',
      action: 'version',
      hostId,
    });
  }

  private normalizeHostId(hostId: number): number | null {
    const normalizedHostId = Number(hostId);
    return Number.isInteger(normalizedHostId) && normalizedHostId > 0 ? normalizedHostId : null;
  }
}

export const dashboardCacheInvalidationService = new DashboardCacheInvalidationService();
export default dashboardCacheInvalidationService;