import { PartitionMaintenanceHelper, partitionMaintenanceHelper } from '../helpers/partition-maintenance.helper';

const ACTIVITY_LOG_TABLE = 'wd_activity_logs';
const ACTIVITY_LOG_PARTITION_LOCK = 'wd_activity_logs:ensure_next_partition';

export class ActivityLogService {
  public constructor(
    private readonly partitionMaintenanceHelperObj: PartitionMaintenanceHelper = partitionMaintenanceHelper,
  ) {}

  public async ensureNextPartition(): Promise<void> {
    await this.partitionMaintenanceHelperObj.ensureNextMonthlyPartition({
      tableName: ACTIVITY_LOG_TABLE,
      lockName: ACTIVITY_LOG_PARTITION_LOCK,
      displayName: 'Activity log',
    });
  }
}

export const activityLogService = new ActivityLogService();
