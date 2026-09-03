export interface CacheConfig {
  enabled: boolean;
  defaultTtl: number;
  keyPrefix: string;
}

const DEFAULT_CACHE_ENABLED = true;
const DEFAULT_CACHE_TTL = 60;
const DEFAULT_CACHE_KEY_PREFIX = 'wd24';

function parseBoolean(value: string | undefined, defaultValue: boolean): boolean {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  const normalizedValue = value.trim().toLowerCase();
  if (['true', '1', 'yes', 'on'].includes(normalizedValue)) {
    return true;
  }

  if (['false', '0', 'no', 'off'].includes(normalizedValue)) {
    return false;
  }

  return defaultValue;
}

function parsePositiveInteger(value: string | undefined, defaultValue: number): number {
  if (value === undefined || value.trim() === '') {
    return defaultValue;
  }

  const parsedValue = Number.parseInt(value, 10);
  if (!Number.isInteger(parsedValue) || parsedValue <= 0) {
    return defaultValue;
  }

  return parsedValue;
}

function parseKeyPrefix(value: string | undefined): string {
  const keyPrefix = value?.trim();
  return keyPrefix || DEFAULT_CACHE_KEY_PREFIX;
}

export const cacheConfig: CacheConfig = {
  enabled: parseBoolean(process.env.CACHE_ENABLED, DEFAULT_CACHE_ENABLED),
  defaultTtl: parsePositiveInteger(
    process.env.CACHE_DEFAULT_TTL ?? process.env.CACHE_DEFAULT_TTL_SECONDS,
    DEFAULT_CACHE_TTL,
  ),
  keyPrefix: parseKeyPrefix(process.env.CACHE_KEY_PREFIX),
};

export default cacheConfig;