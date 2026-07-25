import { 
  AttendanceRepository, 
  GpsHistoryRepository, 
  VisitRepository, 
  OrderRepository, 
  OrderProductRepository, 
  PaymentRepository, 
  FeedbackRepository, 
  ImageRepository, 
  CustomerRepository, 
  ProductRepository } from '../repositories';
import { resolveVisitLocalIdForRecord } from '../../../shared/utils/visit-local-id-resolver';
import userRepository from '../repositories/users.repository';
import { CommonUtil } from '../../../shared/utils/common.util';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';

const attendanceRepository = new AttendanceRepository();
const gpsHistoryRepository = new GpsHistoryRepository();
const visitRepository = new VisitRepository();
const orderRepository = new OrderRepository();
const orderProductRepository = new OrderProductRepository();
const paymentRepository = new PaymentRepository();
const feedbackRepository = new FeedbackRepository();
const imageRepository = new ImageRepository();
const customerRepository = new CustomerRepository();
const productRepository = new ProductRepository();

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

          //console.log('Creating new record with data:', { ...data, userId, localId, syncedAt: now });

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
        const { localId, products, items, ...orderData } = record;
        await resolveVisitLocalIdForRecord(userId, orderData);

        const now = Math.floor(Date.now() / 1000);
        const orderProducts = Array.isArray(products) ? products : Array.isArray(items) ? items : undefined;
        let visitId = orderData.visitId;

        if (!visitId) {
          throw new Error('visitLocalId or visitId is required');
        }

        const { visitLocalId, ...orderPayload } = orderData;
        const resolvedOrderData: SyncRecord = {
          ...orderPayload,
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

  async getCustomers(payload: {userId: number, hostId: number}): Promise<any> {
    return await customerRepository.getCustomers(payload);
  }

  async getProducts(payload: {userId: number, hostId: number}): Promise<any> {
    return await productRepository.getProducts(payload);
  }

  async getUserDetails(payload: {userId: number, hostId: number}): Promise<any> {
    // Fetch user settings from the database or any other source
    const userDetails = await userRepository.getUserById(payload);
    //console.log('User details retrieved:', userDetails);
    return userDetails ? this.formatUserWithSettings(userDetails) : {};
  }

  private async formatUserWithSettings(user: { id: number; hostId: number; toJSON: () => any }): Promise<unknown> {
      const userData = user as any;
      // Convert settings array to key-value object
      if (userData.settings && Array.isArray(userData.settings)) {
        userData.settings = CommonUtil.convertSettingsToObject(userData.settings);
  
        // If weeklyOffMask is present, convert it to weeklyOffDays and remove weeklyOffMask
        if (userData.settings?.weeklyOffMask) {
          userData.settings.weeklyOffDays = DateTimeFormatUtil.getWeeklyOffDays(userData.settings.weeklyOffMask);
          delete userData.settings.weeklyOffMask;
        }
      }
      return userData;
    }
}

export default new SyncService();
