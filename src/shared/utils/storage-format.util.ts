import { CommonUtil } from './common.util';

// Storage field format configuration: defines which fields should be formatted and their conversion base
export const STORAGE_FIELD_FORMAT_CONFIG: Record<string, number> = {
  // Storage fields with 1000 base (decimal conversion)
  storageTotalBytes: 1000,
  storageAvailableBytes: 1000,
  storageUsedBytes: 1000,
};

// Storage field rename mapping: maps old field names to new display names
export const STORAGE_FIELD_RENAME_MAP: Record<string, string> = {
  storageTotalBytes: 'totalStorage',
  storageAvailableBytes: 'availableStorage',
  storageUsedBytes: 'usedStorage',
};

export class StorageFormatUtil {
  private static cloneAndFormatStorage(input: unknown, storageFormatConfig?: Record<string, number>, renameMap?: Record<string, string>): unknown {
    if (Array.isArray(input)) {
      return input.map((item) => StorageFormatUtil.cloneAndFormatStorage(item, storageFormatConfig, renameMap));
    }

    if (!input || typeof input !== 'object') {
      return input;
    }

    const config = storageFormatConfig || STORAGE_FIELD_FORMAT_CONFIG;
    const fieldRenameMap = renameMap || STORAGE_FIELD_RENAME_MAP;
    const record = input as Record<string, unknown>;
    const output: Record<string, unknown> = {};

    Object.entries(record).forEach(([key, value]) => {
      if (value && typeof value === 'object') {
        output[key] = StorageFormatUtil.cloneAndFormatStorage(value, storageFormatConfig, renameMap);
        return;
      }

      // Check if field has explicit format config
      const base = config[key];
      if (base) {
        // Handle both number and string number values
        const numValue = typeof value === 'number' ? value : Number(value);
        if (Number.isFinite(numValue) && numValue > 0) {
          const formattedValue = CommonUtil.formatBytes({ bytes: numValue, decimals: 2, base });
          // Use renamed key if exists, otherwise use original key
          const outputKey = fieldRenameMap[key] || key;
          output[outputKey] = formattedValue;
          return;
        }
      }

      output[key] = value;
    });

    return output;
  }

  static formatStorageFieldsByConfig<T>(data: T, storageFormatConfig?: Record<string, number>, renameMap?: Record<string, string>): T {
    return StorageFormatUtil.cloneAndFormatStorage(data, storageFormatConfig, renameMap) as T;
  }
}

export const formatStorageFieldsByConfig = <T>(data: T, storageFormatConfig?: Record<string, number>, renameMap?: Record<string, string>): T => {
  return StorageFormatUtil.formatStorageFieldsByConfig(data, storageFormatConfig, renameMap);
};
