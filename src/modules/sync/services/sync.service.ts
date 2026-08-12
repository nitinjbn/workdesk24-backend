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
  ProductRepository,
  UserDailySummaryRepository,
  VisitSummaryRepository,
  ActivityLogRepository } from '../repositories';
import type { ActivityLogInput } from '../repositories/activity-log.repository';
import { ActivityModule, ACTIVITY_DESCRIPTION_KEYS } from '../../../config/activityLog';
import { User } from '../../../models';
import { resolveVisitLocalIdForRecord } from '../../../shared/utils/visit-local-id-resolver';
import userRepository from '../repositories/users.repository';
import { CommonUtil } from '../../../shared/utils/common.util';
import { DateTimeFormatUtil } from '../../../shared/utils/date-time-format.util';
import moment from 'moment-timezone';
import { CONFIG } from '../../../config/constants';
import { logger } from '../../../config/database';
import { Op, Transaction } from 'sequelize';
import { locationResolutionService, type LocationResolutionTarget } from '../../../infrastructure/background-jobs/services/location-resolution.service';
import { getRedisConnectionStatus } from '../../../infrastructure/background-jobs/config/redis.config';

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
const userDailySummaryRepository = new UserDailySummaryRepository();
const visitSummaryRepository = new VisitSummaryRepository();
const activityLogRepository = new ActivityLogRepository();

interface SyncRecord {
  localId?: string;
  [key: string]: any;
}

interface SyncResult {
  success: Array<{ localId?: string; serverId: number }>;
  failed: Array<{ localId?: string; error: string }>;
  updated: Array<{ localId?: string; serverId: number }>;
}

interface SyncTransactionResult {
  status: 'created' | 'updated';
  serverId: number;
  persistedRecord: SyncRecord;
  previousRecord?: SyncRecord;
}

interface LocationSyncConfig extends LocationResolutionTarget {
  readonly recordId: number;
}

type ActivityLogFactory = (record: SyncRecord) => Omit<ActivityLogInput, 'hostId' | 'userId' | 'entityId' | 'activityTime'> | null;

export class SyncService {
  private async logActivity(
    record: SyncRecord,
    factory: ActivityLogFactory,
    transaction: Transaction
  ): Promise<void> {
    const hostId = Number(record.hostId);
    const userId = Number(record.userId);
    const entityId = Number(record.id);

    if (!Number.isInteger(hostId) || hostId <= 0 || !Number.isInteger(userId) || userId <= 0 || !Number.isInteger(entityId) || entityId <= 0) {
      return;
    }

    const entry = factory(record);
    if (!entry) {
      return;
    }

    const activityTime = Number((record as any).activityTime ?? (record as any).attendanceTime ?? (record as any).checkInTime ?? (record as any).orderTime ?? (record as any).paymentDate ?? (record as any).feedbackTime ?? (record as any).capturedAt ?? Math.floor(Date.now() / 1000));

    const userRow = await User.findOne({ attributes: ['name'], where: { id: userId, hostId }, transaction });
    const employeeName: string | null = (userRow as any)?.name ?? null;

    await activityLogRepository.log(
      {
        hostId,
        userId,
        customerId: record.customerId ? Number(record.customerId) : entry.metadata.customerId ? Number(entry.metadata.customerId) : undefined,
        entityId,
        activityTime: Number.isFinite(activityTime) && activityTime > 0 ? activityTime : Math.floor(Date.now() / 1000),
        ...entry,
        metadata: { employeeName, ...entry.metadata },
      },
      transaction
    );
  }

  async syncData(
    repository: any,
    userId: number,
    records: SyncRecord[],
    afterPersist?: (record: SyncRecord, transaction: Transaction, previousRecord?: SyncRecord) => Promise<void>,
    afterCommit?: (record: SyncRecord, previousRecord?: SyncRecord) => Promise<void>
  ): Promise<SyncResult> {
    const results: SyncResult = {
      success: [],
      failed: [],
      updated: [],
    };

    for (const record of records) {
      try {
        const { localId, ...data } = record;
        const now = Math.floor(Date.now() / 1000);
        const syncResult = await repository.getSequelize().transaction(async (transaction: Transaction): Promise<SyncTransactionResult> => {
          const instance = localId
            ? await repository.findOne({ userId, localId }, transaction)
            : null;

          if (instance) {
            const previousRecord = instance.toJSON();
            const updatedRecord = await repository.update(instance.id, {
              ...data,
              userId,
              syncedAt: now,
            }, transaction);

            if (!updatedRecord) {
              throw new Error(`Unable to update record ${instance.id}`);
            }

            const persistedRecord = updatedRecord.toJSON();
            await afterPersist?.(record, transaction, previousRecord);
            return { status: 'updated', serverId: instance.id, persistedRecord, previousRecord };
          }

          const newRecord = await repository.create({
            ...data,
            userId,
            localId,
            syncedAt: now,
          }, transaction);
          const persistedRecord = newRecord.toJSON();
          await afterPersist?.(record, transaction);
          return { status: 'created', serverId: newRecord.id, persistedRecord };
        });

        if (afterCommit) {
          await afterCommit(syncResult.persistedRecord, syncResult.previousRecord);
        }

        if (syncResult.status === 'updated') {
          results.updated.push({ localId, serverId: syncResult.serverId });
        } else {
          results.success.push({ localId, serverId: syncResult.serverId });
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
    return this.syncData(
      attendanceRepository,
      userId,
      records,
      async (record, transaction, previousRecord) => {
        await this.syncUserDailySummary(record, transaction);
        await this.logActivity(
          record,
          (r) => ({
            module: ActivityModule.ATTENDANCE,
            action: previousRecord ? 'DAYOVER_MARKED' : 'ATTENDANCE_MARKED',
            descriptionKey: previousRecord ? ACTIVITY_DESCRIPTION_KEYS.DAYOVER_MARKED : ACTIVITY_DESCRIPTION_KEYS.ATTENDANCE_MARKED,
            metadata: {
              attendanceTime: r.attendanceTime ?? null,
              dayoverTime: r.dayoverTime ?? null,
              workingHours: r.workingHours ?? null,
              attendanceStatus: r.attendanceStatus ?? null,
            },
          }),
          transaction
        );
      },
      async (record, previousRecord) => {
        await this.scheduleAttendanceLocationJobs(record, previousRecord);
      }
    );
  }

  private async scheduleAttendanceLocationJobs(record: SyncRecord, previousRecord?: SyncRecord): Promise<void> {
    const locationTargets: ReadonlyArray<LocationSyncConfig> = [
      {
        recordId: Number(record.id),
        entityType: 'attendance',
        addressField: 'attendanceAddress',
        latitudeField: 'attendanceLatitude',
        longitudeField: 'attendanceLongitude',
      },
      {
        recordId: Number(record.id),
        entityType: 'attendance',
        addressField: 'dayoverAddress',
        latitudeField: 'dayoverLatitude',
        longitudeField: 'dayoverLongitude',
      },
    ];

    for (const target of locationTargets) {
      await this.scheduleLocationResolution(record, target);
    }
  }

  private async scheduleLocationResolution(record: SyncRecord, target: LocationSyncConfig): Promise<void> {
    const recordId = Number(record.id ?? target.recordId);
    const hostId = Number(record.hostId);
    const userId = Number(record.userId);

    if (!Number.isInteger(recordId) || recordId <= 0 || !Number.isInteger(hostId) || hostId <= 0 || !Number.isInteger(userId) || userId <= 0) {
      return;
    }

    try {
      const dispatchedJob = await locationResolutionService.schedule({
        hostId,
        userId,
        recordId,
        entityType: target.entityType,
        addressField: target.addressField,
        latitudeField: target.latitudeField,
        longitudeField: target.longitudeField,
        record,
      });

      if (dispatchedJob) {
        logger.info('Location resolution job scheduled.', {
          recordId,
          hostId,
          userId,
          entityType: target.entityType,
          addressField: target.addressField,
          jobId: dispatchedJob.id,
          redisStatus: getRedisConnectionStatus(),
        });
      }
    } catch (error: any) {
      logger.error('Failed to schedule location resolution job.', {
        recordId,
        hostId,
        userId,
        entityType: target.entityType,
        addressField: target.addressField,
        error: error?.message || String(error),
        cause: error?.cause?.message || error?.cause || undefined,
        redisStatus: getRedisConnectionStatus(),
      });
    }
  }

  private async syncUserDailySummary(attendance: SyncRecord, transaction: Transaction): Promise<void> {
    const hostId = Number(attendance.hostId);
    const attendanceTime = Number(attendance.attendanceTime);

    if (!Number.isInteger(hostId) || hostId <= 0) {
      throw new Error('hostId is required to sync the user daily summary');
    }

    if (!Number.isFinite(attendanceTime) || attendanceTime <= 0) {
      throw new Error('attendanceTime is required to sync the user daily summary');
    }

    const attendanceStatus = attendance.attendanceStatus;
    if (typeof attendanceStatus !== 'string' || !attendanceStatus) {
      throw new Error('attendanceStatus is required to sync the user daily summary');
    }

    const workingHours = Number(attendance.workingHours);
    const workingMinutes = Number.isFinite(workingHours)
      ? Math.round(workingHours * 60)
      : 0;
    const reportDate = moment
      .unix(attendanceTime)
      .tz(CONFIG.REPORTING.TIMEZONE)
      .startOf('day')
      .unix();
    const summaryData = {
      attendanceStatus,
      attendanceTime,
      dayoverTime: attendance.dayoverTime ?? null,
      workingMinutes,
    };
    const existingSummary = await userDailySummaryRepository.findByReportDate(
      hostId,
      Number(attendance.userId),
      reportDate,
      transaction
    );

    if (existingSummary) {
      await userDailySummaryRepository.update(existingSummary.id, summaryData as any, transaction);
      await this.refreshUserDailySummary(hostId, Number(attendance.userId), reportDate, transaction);
      return;
    }

    await userDailySummaryRepository.create({
      hostId,
      userId: Number(attendance.userId),
      reportDate,
      ...summaryData,
    } as any, transaction);

    await this.refreshUserDailySummary(hostId, Number(attendance.userId), reportDate, transaction);
  }

  async syncGpsHistory(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(gpsHistoryRepository, userId, records);
  }

  async syncVisits(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(
      visitRepository,
      userId,
      records,
      async (visit, transaction, previousVisit) => {
        await this.syncVisitSummaryForVisit(visit, transaction);
        await this.syncDailySummaryForActivity(visit, 'checkInTime', transaction, previousVisit);
        await this.logActivity(
          visit,
          (r) => ({
            module: ActivityModule.VISIT,
            action: previousVisit ? 'VISIT_CHECKOUT' : 'VISIT_CHECKIN',
            descriptionKey: previousVisit ? ACTIVITY_DESCRIPTION_KEYS.VISIT_CHECKOUT : ACTIVITY_DESCRIPTION_KEYS.VISIT_CHECKIN,
            metadata: {
              checkInTime: r.checkInTime ?? null,
              checkOutTime: r.checkOutTime ?? null,
              customerId: r.customerId ?? null,
              customerName: r.customerName ?? null,
            },
          }),
          transaction
        );
      },
      async (record, previousRecord) => {
        await this.scheduleVisitLocationJobs(record, previousRecord);
      }
    );
  }

  private async scheduleVisitLocationJobs(record: SyncRecord, previousRecord?: SyncRecord): Promise<void> {
    const locationTargets: ReadonlyArray<LocationSyncConfig> = [
      {
        recordId: Number(record.id),
        entityType: 'visit',
        addressField: 'checkInAddress',
        latitudeField: 'checkInLatitude',
        longitudeField: 'checkInLongitude',
      },
      {
        recordId: Number(record.id),
        entityType: 'visit',
        addressField: 'checkOutAddress',
        latitudeField: 'checkOutLatitude',
        longitudeField: 'checkOutLongitude',
      },
    ];

    for (const target of locationTargets) {
      await this.scheduleLocationResolution(record, target);
    }
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
        const now = Math.floor(Date.now() / 1000);
        const orderProducts = Array.isArray(products) ? products : Array.isArray(items) ? items : undefined;
        const syncResult = await orderRepository.getSequelize().transaction(async (transaction: Transaction) => {
          await resolveVisitLocalIdForRecord(userId, orderData, new Map(), transaction);
          const visitId = orderData.visitId;

          if (!visitId) {
            throw new Error('visitLocalId or visitId is required');
          }

          const { visitLocalId, ...orderPayload } = orderData;
          const resolvedOrderData: SyncRecord = {
            ...orderPayload,
            visitId,
          };
          const instance = localId
            ? await orderRepository.findOne({ userId, localId } as any, transaction)
            : null;
          const previousOrder = instance?.toJSON();
          const order = instance
            ? await orderRepository.update(instance.id, {
                ...resolvedOrderData,
                userId,
                syncedAt: now,
              }, transaction)
            : await orderRepository.create({
                ...resolvedOrderData,
                userId,
                localId,
                syncedAt: now,
              }, transaction);

          if (!order) {
            throw new Error('Unable to save order');
          }

          if (orderProducts) {
            await orderProductRepository.replaceForOrder(
              order.id,
              userId,
              orderProducts.map((product) => ({
                ...product,
                visitId,
                customerId: product.customerId ?? resolvedOrderData.customerId,
              })),
              now,
              transaction
            );
          }

          await this.syncVisitSummaryForActivity(order.toJSON(), transaction, previousOrder);
          await this.syncDailySummaryForActivity(order.toJSON(), 'orderTime', transaction, previousOrder);
          await this.logActivity(
            order.toJSON(),
            (r) => ({
              module: ActivityModule.ORDER,
              action: 'ORDER_CREATED',
              descriptionKey: ACTIVITY_DESCRIPTION_KEYS.ORDER_CREATED,
              metadata: {
                orderTime: r.orderTime ?? null,
                totalAmount: r.totalAmount ?? null,
                customerId: r.customerId ?? null,
                customerName: r.customerName ?? null,
              },
            }),
            transaction
          );

          return {
            status: instance ? 'updated' as const : 'created' as const,
            serverId: order.id,
            persistedRecord: order.toJSON(),
            previousRecord: previousOrder,
          };
        });

        // Its commented out because the location resolution jobs are already scheduled in the syncVisitSummaryForActivity method, which is called above. Scheduling them again here would be redundant and could lead to unnecessary processing.
        //await this.scheduleOrderLocationJobs(syncResult.persistedRecord, syncResult.previousRecord);

        if (syncResult.status === 'updated') {
          results.updated.push({ localId, serverId: syncResult.serverId });
        } else {
          results.success.push({ localId, serverId: syncResult.serverId });
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

  private async scheduleOrderLocationJobs(record: SyncRecord, previousRecord?: SyncRecord): Promise<void> {
    const locationTargets: ReadonlyArray<LocationSyncConfig> = [
      {
        recordId: Number(record.id),
        entityType: 'order',
        addressField: 'address',
        latitudeField: 'latitude',
        longitudeField: 'longitude',
      },
    ];

    for (const target of locationTargets) {
      await this.scheduleLocationResolution(record, target);
    }
  }

  async syncPayments(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(
      paymentRepository,
      userId,
      records,
      async (payment, transaction, previousPayment) => {
        await this.syncVisitSummaryForActivity(payment, transaction, previousPayment);
        await this.syncDailySummaryForActivity(payment, 'paymentDate', transaction, previousPayment);
        await this.logActivity(
          payment,
          (r) => ({
            module: ActivityModule.PAYMENT,
            action: 'PAYMENT_COLLECTED',
            descriptionKey: ACTIVITY_DESCRIPTION_KEYS.PAYMENT_COLLECTED,
            metadata: {
              paymentDate: r.paymentDate ?? null,
              amount: r.amount ?? null,
              customerId: r.customerId ?? null,
              customerName: r.customerName ?? null,
            },
          }),
          transaction
        );
      },
      // async (record, previousRecord) => {
      //   await this.schedulePaymentLocationJobs(record, previousRecord);
      // }
    );
    // The scheduling of payment location jobs is commented out because the location resolution jobs are already scheduled in the syncVisitSummaryForActivity method, which is called above. Scheduling them again here would be redundant and could lead to unnecessary processing.
  }

  private async schedulePaymentLocationJobs(record: SyncRecord, previousRecord?: SyncRecord): Promise<void> {
    const locationTargets: ReadonlyArray<LocationSyncConfig> = [
      {
        recordId: Number(record.id),
        entityType: 'payment',
        addressField: 'address',
        latitudeField: 'latitude',
        longitudeField: 'longitude',
      },
    ];

    for (const target of locationTargets) {
      await this.scheduleLocationResolution(record, target);
    }
  }

  async syncFeedback(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(
      feedbackRepository,
      userId,
      records,
      async (feedback, transaction, previousFeedback) => {
        await this.syncVisitSummaryForActivity(feedback, transaction, previousFeedback);
        await this.syncDailySummaryForActivity(feedback, 'feedbackTime', transaction, previousFeedback);
        await this.logActivity(
          feedback,
          (r) => ({
            module: ActivityModule.FEEDBACK,
            action: 'FEEDBACK_SUBMITTED',
            descriptionKey: ACTIVITY_DESCRIPTION_KEYS.FEEDBACK_SUBMITTED,
            metadata: {
              employeeName: r.employeeName ?? null,
              feedbackTime: r.feedbackTime ?? null,
              rating: r.rating ?? null,
              customerId: r.customerId ?? null,
              customerName: r.customerName ?? null,
              customerCode: r.customerCode ?? null,
            },
          }),
          transaction
        );
      },
      // async (record, previousRecord) => {
      //   await this.scheduleFeedbackLocationJobs(record, previousRecord);
      // }
    );
    // The scheduling of feedback location jobs is commented out because the location resolution jobs are already scheduled in the syncVisitSummaryForActivity method, which is called above. Scheduling them again here would be redundant and could lead to unnecessary processing.
  }

  private async scheduleFeedbackLocationJobs(record: SyncRecord, previousRecord?: SyncRecord): Promise<void> {
    const locationTargets: ReadonlyArray<LocationSyncConfig> = [
      {
        recordId: Number(record.id),
        entityType: 'feedback',
        addressField: 'address',
        latitudeField: 'latitude',
        longitudeField: 'longitude',
      },
    ];

    for (const target of locationTargets) {
      await this.scheduleLocationResolution(record, target);
    }
  }

  async syncImages(userId: number, records: SyncRecord[]): Promise<SyncResult> {
    return this.syncData(
      imageRepository,
      userId,
      records,
      async (image, transaction, previousImage) => {
        await this.syncVisitSummaryForActivity(image, transaction, previousImage);
        await this.syncDailySummaryForActivity(image, 'capturedAt', transaction, previousImage);
        await this.logActivity(
          image,
          (r) => ({
            module: ActivityModule.IMAGE,
            action: 'IMAGE_UPLOADED',
            descriptionKey: ACTIVITY_DESCRIPTION_KEYS.IMAGE_UPLOADED,
            metadata: {
              capturedAt: r.capturedAt ?? null,
              customerId: r.customerId ?? null,
              customerName: r.customerName ?? null,
            },
          }),
          transaction
        );
      },
      // async (record, previousRecord) => {
      //   await this.scheduleImageLocationJobs(record, previousRecord);
      // }
    );
    // The scheduling of image location jobs is commented out because the location resolution jobs are already scheduled in the syncVisitSummaryForActivity method, which is called above. Scheduling them again here would be redundant and could lead to unnecessary processing.
  }

  private async scheduleImageLocationJobs(record: SyncRecord, previousRecord?: SyncRecord): Promise<void> {
    const locationTargets: ReadonlyArray<LocationSyncConfig> = [
      {
        recordId: Number(record.id),
        entityType: 'image',
        addressField: 'address',
        latitudeField: 'latitude',
        longitudeField: 'longitude',
      },
    ];

    for (const target of locationTargets) {
      await this.scheduleLocationResolution(record, target);
    }
  }

  private async syncVisitSummaryForVisit(visit: SyncRecord, transaction: Transaction): Promise<void> {
    const hostId = Number(visit.hostId);
    const userId = Number(visit.userId);
    const visitId = Number(visit.id);

    if (!Number.isInteger(hostId) || hostId <= 0 || !Number.isInteger(userId) || userId <= 0 || !Number.isInteger(visitId) || visitId <= 0) {
      throw new Error('hostId, userId, and visitId are required to sync the visit summary');
    }

    const summary = await visitSummaryRepository.findByVisit(hostId, userId, visitId, transaction);
    if (!summary) {
      await visitSummaryRepository.create({ hostId, userId, visitId } as any, transaction);
    }

    await this.refreshVisitSummary(hostId, userId, visitId, transaction);
  }

  private async syncVisitSummaryForActivity(
    record: SyncRecord,
    transaction: Transaction,
    previousRecord?: SyncRecord
  ): Promise<void> {
    const hostId = Number(record.hostId);
    const userId = Number(record.userId);
    const visitId = Number(record.visitId);

    if (!Number.isInteger(hostId) || hostId <= 0 || !Number.isInteger(userId) || userId <= 0 || !Number.isInteger(visitId) || visitId <= 0) {
      throw new Error('hostId, userId, and visitId are required to sync the visit summary');
    }

    await this.refreshVisitSummary(hostId, userId, visitId, transaction);

    if (previousRecord) {
      const previousHostId = Number(previousRecord.hostId);
      const previousUserId = Number(previousRecord.userId);
      const previousVisitId = Number(previousRecord.visitId);
      if (previousHostId !== hostId || previousUserId !== userId || previousVisitId !== visitId) {
        await this.refreshVisitSummary(previousHostId, previousUserId, previousVisitId, transaction);
      }
    }
  }

  private async refreshVisitSummary(
    hostId: number,
    userId: number,
    visitId: number,
    transaction: Transaction
  ): Promise<void> {
    const summary = await visitSummaryRepository.findByVisit(hostId, userId, visitId, transaction);
    if (!summary) {
      throw new Error(`Visit summary not found for visitId ${visitId}; sync the visit before its related activity`);
    }

    const where = { hostId, userId, visitId };
    const [orders, payments, feedbacks, images] = await Promise.all([
      orderRepository.findAll({ where: where as any, transaction }),
      paymentRepository.findAll({ where: where as any, transaction }),
      feedbackRepository.findAll({ where: where as any, transaction }),
      imageRepository.findAll({ where: where as any, transaction }),
    ]);
    const orderIds = orders.map((order) => order.id);
    const orderProducts = orderIds.length
      ? await orderProductRepository.findAll({
          where: { orderId: { [Op.in]: orderIds } } as any,
          transaction,
        })
      : [];
    const uniqueProducts = new Set(
      orderProducts.map((product: any) => product.productId ?? product.productName).filter(Boolean)
    );
    const total = (records: any[], field: string) => records.reduce((sum, record) => sum + (Number(record[field]) || 0), 0);

    await visitSummaryRepository.update(summary.id, {
      totalOrders: orders.length,
      orderAmount: total(orders, 'totalAmount'),
      totalUniqueProducts: uniqueProducts.size,
      totalQuantity: total(orderProducts, 'quantity'),
      totalPayments: payments.length,
      paymentAmount: total(payments, 'amount'),
      totalFeedbacks: feedbacks.length,
      totalImages: images.length,
    } as any, transaction);
  }

  private async syncDailySummaryForActivity(
    record: SyncRecord,
    timestampField: string,
    transaction: Transaction,
    previousRecord?: SyncRecord
  ): Promise<void> {
    const hostId = Number(record.hostId);
    const userId = Number(record.userId);
    const timestamp = Number(record[timestampField]);

    if (!Number.isInteger(hostId) || hostId <= 0 || !Number.isInteger(userId) || userId <= 0 || !Number.isFinite(timestamp) || timestamp <= 0) {
      throw new Error(`hostId, userId, and ${timestampField} are required to sync the user daily summary`);
    }

    const reportDate = moment
      .unix(timestamp)
      .tz(CONFIG.REPORTING.TIMEZONE)
      .startOf('day')
      .unix();
    await this.refreshUserDailySummary(hostId, userId, reportDate, transaction);

    if (previousRecord) {
      const previousTimestamp = Number(previousRecord[timestampField]);
      const previousHostId = Number(previousRecord.hostId);
      const previousUserId = Number(previousRecord.userId);
      if (Number.isFinite(previousTimestamp) && previousTimestamp > 0) {
        const previousReportDate = moment
          .unix(previousTimestamp)
          .tz(CONFIG.REPORTING.TIMEZONE)
          .startOf('day')
          .unix();

        if (previousReportDate !== reportDate || previousHostId !== hostId || previousUserId !== userId) {
          await this.refreshUserDailySummary(previousHostId, previousUserId, previousReportDate, transaction);
        }
      }
    }
  }

  private async refreshUserDailySummary(
    hostId: number,
    userId: number,
    reportDate: number,
    transaction: Transaction
  ): Promise<void> {
    const summary = await userDailySummaryRepository.findByReportDate(hostId, userId, reportDate, transaction);

    // A daily summary is created from attendance. Activity synced before attendance
    // is picked up when that attendance record is subsequently synced.
    if (!summary) {
      return;
    }

    const nextReportDate = moment.unix(reportDate).tz(CONFIG.REPORTING.TIMEZONE).add(1, 'day').unix();
    const dateRange = { [Op.gte]: reportDate, [Op.lt]: nextReportDate };
    const where = { hostId, userId };
    const [visits, orders, payments, feedbacks, images] = await Promise.all([
      visitRepository.findAll({ where: { ...where, checkInTime: dateRange } as any, transaction }),
      orderRepository.findAll({ where: { ...where, orderTime: dateRange } as any, transaction }),
      paymentRepository.findAll({ where: { ...where, paymentDate: dateRange } as any, transaction }),
      feedbackRepository.findAll({ where: { ...where, feedbackTime: dateRange } as any, transaction }),
      imageRepository.findAll({ where: { ...where, capturedAt: dateRange } as any, transaction }),
    ]);
    const orderIds = orders.map((order) => order.id);
    const orderProducts = orderIds.length
      ? await orderProductRepository.findAll({
          where: { orderId: { [Op.in]: orderIds } } as any,
          transaction,
        })
      : [];
    const uniqueProducts = new Set(
      orderProducts.map((product: any) => product.productId ?? product.productName).filter(Boolean)
    );
    const total = (records: any[], field: string) => records.reduce((sum, record) => sum + (Number(record[field]) || 0), 0);

    await userDailySummaryRepository.update(summary.id, {
      totalVisits: visits.length,
      totalOrders: orders.length,
      orderAmount: total(orders, 'totalAmount'),
      totalUniqueProducts: uniqueProducts.size,
      totalQuantity: total(orderProducts, 'quantity'),
      totalPayments: payments.length,
      paymentAmount: total(payments, 'amount'),
      totalFeedbacks: feedbacks.length,
      totalImages: images.length,
    } as any, transaction);
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
