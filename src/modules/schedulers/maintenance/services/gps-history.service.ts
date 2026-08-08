import { PartitionMaintenanceHelper, partitionMaintenanceHelper } from '../helpers/partition-maintenance.helper';

const GPS_HISTORY_TABLE = 'wd_gps_history';
const GPS_HISTORY_PARTITION_LOCK = 'wd_gps_history:ensure_next_partition';

export class GpsHistoryService {
  public constructor(
    private readonly partitionMaintenanceHelperObj: PartitionMaintenanceHelper = partitionMaintenanceHelper,
  ) {}

  public async ensureNextPartition(): Promise<void> {
    await this.partitionMaintenanceHelperObj.ensureNextMonthlyPartition({
      tableName: GPS_HISTORY_TABLE,
      lockName: GPS_HISTORY_PARTITION_LOCK,
      displayName: 'GPS history',
    });
  }
}

export const gpsHistoryService = new GpsHistoryService();
