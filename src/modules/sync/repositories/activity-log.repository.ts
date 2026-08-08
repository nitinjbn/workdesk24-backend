import { BaseRepository } from '../../../shared/repositories/base.repository';
import ActivityLog from '../../../models/schemas/ActivityLog';
import { ActivityModule } from '../../../config/activityLog';
import type { Transaction } from 'sequelize';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

export interface ActivityLogInput {
  hostId: number;
  userId: number;
  customerId?: number;
  module: ActivityModule;
  action: string;
  entityId: number;
  descriptionKey: string;
  metadata: Record<string, unknown>;
  activityTime: number;
}

export class ActivityLogRepository extends BaseRepository<typeof ActivityLog.prototype> {
  constructor() {
    super(ActivityLog as any);
  }

  async log(input: ActivityLogInput, transaction: Transaction): Promise<void> {
    await this.create({
      ...input,
      createdAt: DateTimeFormatUtil.getCurrentUnixTime(),
    } as any, transaction);
  }
}

export const activityLogRepository = new ActivityLogRepository();
