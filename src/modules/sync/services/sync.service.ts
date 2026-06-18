import attendanceRepository from '../../staff/repositories/attendance.repository';
import gpsHistoryRepository from '../../staff/repositories/gps-history.repository';
import visitRepository from '../../staff/repositories/visit.repository';
import orderRepository from '../../staff/repositories/order.repository';
import orderProductRepository from '../../staff/repositories/order-product.repository';
import paymentRepository from '../../staff/repositories/payment.repository';
import feedbackRepository from '../../staff/repositories/feedback.repository';
import imageRepository from '../../staff/repositories/image.repository';

interface SyncRecord {
  localId?: string;
  [key: string]: any;
}

interface SyncResult {
  success: Array<{ localId?: string; serverId: number }>;
  failed: Array<{ localId?: string; error: string }>;
  updated: Array<{ localId?: string; serverId: number }>;
}

export class SyncService {
  async syncData(repository: any, userId: number, records: SyncRecord[]): Promise<SyncResult> {
    const results: SyncResult = {
      success: [],
      failed: [],
      updated: [],
    };

    for (const record of records) {
      try {
        const { localId, ...data } = record;
        const now = Math.floor(Date.now() / 1000);

        let instance = null;

        if (localId) {
          instance = await repository.findByLocalId(userId, localId);
        }

        if (instance) {
          await repository.update(instance.id, {
            ...data,
            userId,
            syncedAt: now,
          });
          results.updated.push({
            localId,
            serverId: instance.id,
          });
        } else {

          console.log('Creating new record with data:', { ...data, userId, localId, syncedAt: now });

          const newRecord = await repository.create({
            ...data,
            userId,
            localId,
            syncedAt: now,
          });
          results.success.push({
            localId,
            serverId: newRecord.id,
          });
        }
      } catch (error: any) {
        results.failed.push({
          localId: record.localId,
          error: error.message,
        });
      }
    }

    return results;
  }

  async syncAttendance(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(attendanceRepository, userId, records);
  }

  async syncGpsHistory(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(gpsHistoryRepository, userId, records);
  }

  async syncVisits(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(visitRepository, userId, records);
  }

  async syncOrders(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    const results: SyncResult = {
      success: [],
      failed: [],
      updated: [],
    };

    for (const record of records) {
      try {
        const { localId, products, items, visitLocalId, ...orderData } = record;
        const now = Math.floor(Date.now() / 1000);
        const orderProducts = Array.isArray(products) ? products : Array.isArray(items) ? items : undefined;
        let visitId = orderData.visitId;

        if (visitLocalId) {
          const visit = await visitRepository.findByLocalId(userId, visitLocalId);

          if (!visit) {
            throw new Error(`Visit not found for visitLocalId: ${visitLocalId}`);
          }

          visitId = visit.id;
        }

        if (!visitId) {
          throw new Error('visitLocalId or visitId is required');
        }

        const resolvedOrderData: SyncRecord = {
          ...orderData,
          visitId,
        };

        let instance = null;

        if (localId) {
          instance = await orderRepository.findByLocalId(userId, localId);
        }

        if (instance) {
          await orderRepository.update(instance.id, {
            ...resolvedOrderData,
            userId,
            syncedAt: now,
          });

          if (orderProducts) {
            await orderProductRepository.replaceForOrder(
              instance.id,
              userId,
              orderProducts.map((product) => ({
                ...product,
                visitId,
                customerId: product.customerId ?? resolvedOrderData.customerId,
              })),
              now
            );
          }

          results.updated.push({
            localId,
            serverId: instance.id,
          });
        } else {
          const newRecord = await orderRepository.create({
            ...resolvedOrderData,
            userId,
            localId,
            syncedAt: now,
          });

          if (orderProducts) {
            await orderProductRepository.replaceForOrder(
              newRecord.id,
              userId,
              orderProducts.map((product) => ({
                ...product,
                visitId,
                customerId: product.customerId ?? resolvedOrderData.customerId,
              })),
              now
            );
          }

          results.success.push({
            localId,
            serverId: newRecord.id,
          });
        }
      } catch (error: any) {
        results.failed.push({
          localId: record.localId,
          error: error.message,
        });
      }
    }

    return results;
  }

  async syncPayments(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(paymentRepository, userId, records);
  }

  async syncFeedback(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(feedbackRepository, userId, records);
  }

  async syncImages(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(imageRepository, userId, records);
  }

  async syncAll(userId: number, data: any): Promise<any> {
    const result: any = {};

    if (data.attendance?.length) {
      result.attendance = await this.syncAttendance(userId, data.attendance);
    }

    if (data.gpsHistory?.length) {
      result.gpsHistory = await this.syncGpsHistory(userId, data.gpsHistory);
    }

    if (data.visits?.length) {
      result.visits = await this.syncVisits(userId, data.visits);
    }

    if (data.orders?.length) {
      result.orders = await this.syncOrders(userId, data.orders);
    }

    if (data.payments?.length) {
      result.payments = await this.syncPayments(userId, data.payments);
    }

    if (data.feedback?.length) {
      result.feedback = await this.syncFeedback(userId, data.feedback);
    }

    if (data.images?.length) {
      result.images = await this.syncImages(userId, data.images);
    }

    return result;
  }

  async getUpdates(userId: number, lastSyncTime: number): Promise<any> {
    const updates: any = {};

    updates.attendance = await attendanceRepository.findAll({
      where: { userId, updatedAt: { $gt: lastSyncTime } } as any,
    });

    updates.gpsHistory = await gpsHistoryRepository.findAll({
      where: { userId, updatedAt: { $gt: lastSyncTime } } as any,
    });

    updates.visits = await visitRepository.findAll({
      where: { userId, updatedAt: { $gt: lastSyncTime } } as any,
    });

    updates.orders = await orderRepository.findAll({
      where: { userId, updatedAt: { $gt: lastSyncTime } } as any,
    });

    updates.payments = await paymentRepository.findAll({
      where: { userId, updatedAt: { $gt: lastSyncTime } } as any,
    });

    updates.feedback = await feedbackRepository.findAll({
      where: { userId, updatedAt: { $gt: lastSyncTime } } as any,
    });

    updates.images = await imageRepository.findAll({
      where: { userId, updatedAt: { $gt: lastSyncTime } } as any,
    });

    return updates;
  }

  async getSyncStatus(userId: number): Promise<any> {
    const counts = {
      attendance: await attendanceRepository.count({ userId } as any),
      gpsHistory: await gpsHistoryRepository.count({ userId } as any),
      visits: await visitRepository.count({ userId } as any),
      orders: await orderRepository.count({ userId } as any),
      payments: await paymentRepository.count({ userId } as any),
      feedback: await feedbackRepository.count({ userId } as any),
      images: await imageRepository.count({ userId } as any),
    };

    return {
      userId,
      counts,
      lastSyncTime: Math.floor(Date.now() / 1000),
    };
  }
}

export default new SyncService();
