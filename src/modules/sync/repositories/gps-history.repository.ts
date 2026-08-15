import { BaseRepository } from '../../../shared/repositories/base.repository';
import GpsHistory from '../../../models/schemas/GpsHistory';
import UserLastLocation from '../../../models/schemas/UserLastLocations';
import { WhereOptions, Op, Transaction } from 'sequelize';

export interface UserLastLocationUpsertPayload {
  hostId: number;
  userId: number;
  latitude: number;
  longitude: number;
  locationTime: number;
  localId?: string;
  accuracy?: number;
  altitude?: number;
  speed?: number;
  provider?: string;
  batteryPercentage?: number;
  isCharging?: number;
}

export class GpsHistoryRepository extends BaseRepository<typeof GpsHistory.prototype> {
  constructor() {
    super(GpsHistory as any);
  }

  async findByUserId(userId: number): Promise<typeof GpsHistory.prototype[]> {
    return this.findAll({
      where: { userId } as WhereOptions<typeof GpsHistory.prototype>,
      order: [['timestamp', 'DESC']],
    });
  }

  async findByLocalId(userId: number, localId: string): Promise<typeof GpsHistory.prototype | null> {
    return this.findOne({
      userId,
      localId,
    } as WhereOptions<typeof GpsHistory.prototype>);
  }

  async findByDateRange(userId: number, startTime: number, endTime: number): Promise<typeof GpsHistory.prototype[]> {
    return this.findAll({
      where: {
        userId,
        timestamp: {
          [Op.between]: [startTime, endTime],
        },
      } as WhereOptions<typeof GpsHistory.prototype>,
      order: [['timestamp', 'DESC']],
    });
  }

  async upsertUserLastLocation(
    payload: UserLastLocationUpsertPayload,
    transaction?: Transaction
  ): Promise<typeof UserLastLocation.prototype> {
    const [row] = await UserLastLocation.upsert(
      {
        hostId: payload.hostId,
        userId: payload.userId,
        localId: payload.localId,
        latitude: payload.latitude,
        longitude: payload.longitude,
        accuracy: payload.accuracy,
        altitude: payload.altitude,
        speed: payload.speed,
        provider: payload.provider,
        batteryPercentage: payload.batteryPercentage,
        isCharging: payload.isCharging,
        locationTime: payload.locationTime,
      },
      {
        transaction,
        returning: true,
      }
    );

    return row;
  }
}
