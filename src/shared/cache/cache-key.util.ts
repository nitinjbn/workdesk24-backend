import cacheConfig from '../../config/cache';
import type { CacheKeyPart, TenantCacheKeyInput } from './cache.types';

const SAFE_KEY_PART_PATTERN = /[^a-zA-Z0-9._-]/g;

export class CacheKeyUtil {
  public static buildTenantKey(input: TenantCacheKeyInput, keyPrefix = cacheConfig.keyPrefix): string {
    const hostId = CacheKeyUtil.normalizeRequiredPart(input.hostId ?? input.tenantId, 'hostId');

    const parts: CacheKeyPart[] = [
      input.version,
      input.module,
      input.resource,
      input.action,
      hostId,
      input.userId === undefined ? undefined : `user-${CacheKeyUtil.normalizeRequiredPart(input.userId, 'userId')}`,
      input.teamId === undefined ? undefined : `team-${CacheKeyUtil.normalizeRequiredPart(input.teamId, 'teamId')}`,
      input.date === undefined ? undefined : `date-${CacheKeyUtil.normalizeRequiredPart(input.date, 'date')}`,
      input.scope,
      input.identifier,
    ].flatMap((part) => CacheKeyUtil.toParts(part));

    return CacheKeyUtil.withPrefix(
      parts.map((part) => CacheKeyUtil.normalizeRequiredPart(part, 'cacheKeyPart')),
      keyPrefix,
    );
  }

  public static withPrefix(parts: CacheKeyPart[], keyPrefix = cacheConfig.keyPrefix): string {
    const normalizedPrefix = CacheKeyUtil.normalizeRequiredPart(keyPrefix, 'keyPrefix');
    const normalizedParts = parts.map((part) => CacheKeyUtil.normalizeRequiredPart(part, 'cacheKeyPart'));
    return [normalizedPrefix, ...normalizedParts].join(':');
  }

  public static hasConfiguredPrefix(key: string, keyPrefix = cacheConfig.keyPrefix): boolean {
    const normalizedPrefix = CacheKeyUtil.normalizeRequiredPart(keyPrefix, 'keyPrefix');
    return key === normalizedPrefix || key.startsWith(`${normalizedPrefix}:`);
  }

  private static toParts(part: CacheKeyPart | CacheKeyPart[] | undefined): CacheKeyPart[] {
    if (part === undefined) {
      return [];
    }

    return Array.isArray(part) ? part : [part];
  }

  private static normalizeRequiredPart(part: CacheKeyPart, label: string): string {
    if (!['string', 'number', 'boolean'].includes(typeof part)) {
      throw new Error(`Cache key ${label} must be a string, number, or boolean`);
    }

    const value = String(part).trim();
    if (!value) {
      throw new Error(`Cache key ${label} is required`);
    }

    return value.toLowerCase().replace(SAFE_KEY_PART_PATTERN, '-');
  }
}

export const buildTenantCacheKey = (input: TenantCacheKeyInput, keyPrefix?: string): string => {
  return CacheKeyUtil.buildTenantKey(input, keyPrefix);
};