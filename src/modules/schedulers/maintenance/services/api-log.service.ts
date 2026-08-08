import { PartitionMaintenanceHelper, partitionMaintenanceHelper } from '../helpers/partition-maintenance.helper';

const API_LOG_TABLE = 'wd_api_logs';
const API_LOG_PARTITION_LOCK = 'wd_api_logs:ensure_next_partition';

export class ApiLogService {
  public constructor(
    private readonly partitionMaintenanceHelperObj: PartitionMaintenanceHelper = partitionMaintenanceHelper,
  ) {}

  public async ensureNextPartition(): Promise<void> {
    await this.partitionMaintenanceHelperObj.ensureNextMonthlyPartition({
      tableName: API_LOG_TABLE,
      lockName: API_LOG_PARTITION_LOCK,
      displayName: 'API log',
    });
  }
}

export const apiLogService = new ApiLogService();
