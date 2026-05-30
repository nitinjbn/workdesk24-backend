const {
  Attendance,
  GpsHistory,
  Visit,
  Order,
  Payment,
  Feedback,
  Image
} = require('../models');
const { Op } = require('sequelize');

class SyncService {
  // Generic sync function for any model
  async syncData(Model, userId, records) {
    const results = {
      success: [],
      failed: [],
      updated: [],
    };

    for (const record of records) {
      try {
        const { localId, ...data } = record;
        data.userId = userId;
        data.syncedAt = new Date();

        let instance;

        // Check if record already exists by localId
        if (localId) {
          instance = await Model.findOne({
            where: { userId, localId },
          });
        }

        if (instance) {
          // Update existing record
          await instance.update(data);
          results.updated.push({
            localId,
            serverId: instance.id,
          });
        } else {
          // Create new record
          const newRecord = await Model.create({ ...data, localId });
          results.success.push({
            localId,
            serverId: newRecord.id,
          });
        }
      } catch (error) {
        results.failed.push({
          localId: record.localId,
          error: error.message,
        });
      }
    }

    return results;
  }

  // Sync attendance records
  async syncAttendance(userId, records) {
    return this.syncData(Attendance, userId, records);
  }

  // Sync GPS history records
  async syncGpsHistory(userId, records) {
    return this.syncData(GpsHistory, userId, records);
  }

  // Sync visit records
  async syncVisits(userId, records) {
    return this.syncData(Visit, userId, records);
  }

  // Sync order records
  async syncOrders(userId, records) {
    return this.syncData(Order, userId, records);
  }

  // Sync payment records
  async syncPayments(userId, records) {
    return this.syncData(Payment, userId, records);
  }

  // Sync feedback records
  async syncFeedback(userId, records) {
    return this.syncData(Feedback, userId, records);
  }

  // Sync image records
  async syncImages(userId, records) {
    return this.syncData(Image, userId, records);
  }

  // Bulk sync all data types
  async syncAll(userId, data) {
    const results = {};

    if (data.attendance && Array.isArray(data.attendance)) {
      results.attendance = await this.syncAttendance(userId, data.attendance);
    }

    if (data.gpsHistory && Array.isArray(data.gpsHistory)) {
      results.gpsHistory = await this.syncGpsHistory(userId, data.gpsHistory);
    }

    if (data.visits && Array.isArray(data.visits)) {
      results.visits = await this.syncVisits(userId, data.visits);
    }

    if (data.orders && Array.isArray(data.orders)) {
      results.orders = await this.syncOrders(userId, data.orders);
    }

    if (data.payments && Array.isArray(data.payments)) {
      results.payments = await this.syncPayments(userId, data.payments);
    }

    if (data.feedback && Array.isArray(data.feedback)) {
      results.feedback = await this.syncFeedback(userId, data.feedback);
    }

    if (data.images && Array.isArray(data.images)) {
      results.images = await this.syncImages(userId, data.images);
    }

    return results;
  }

  // Get updates since last sync
  async getUpdates(userId, lastSyncTime) {
    const whereClause = {
      userId,
    };

    if (lastSyncTime) {
      whereClause.updatedAt = {
        [Op.gt]: new Date(lastSyncTime),
      };
    }

    const [attendance, gpsHistory, visits, orders, payments, feedback, images] = await Promise.all([
      Attendance.findAll({ where: whereClause, limit: 100 }),
      GpsHistory.findAll({ where: whereClause, limit: 500 }),
      Visit.findAll({ where: whereClause, limit: 100 }),
      Order.findAll({ where: whereClause, limit: 100 }),
      Payment.findAll({ where: whereClause, limit: 100 }),
      Feedback.findAll({ where: whereClause, limit: 100 }),
      Image.findAll({ where: whereClause, limit: 200 }),
    ]);

    return {
      attendance,
      gpsHistory,
      visits,
      orders,
      payments,
      feedback,
      images,
      syncTime: new Date(),
    };
  }

  // Get sync status for user
  async getSyncStatus(userId) {
    const [attendance, gpsHistory, visits, orders, payments, feedback, images] = await Promise.all([
      Attendance.count({ where: { userId } }),
      GpsHistory.count({ where: { userId } }),
      Visit.count({ where: { userId } }),
      Order.count({ where: { userId } }),
      Payment.count({ where: { userId } }),
      Feedback.count({ where: { userId } }),
      Image.count({ where: { userId } }),
    ]);

    const lastSync = await this.getLastSyncTime(userId);

    return {
      counts: {
        attendance,
        gpsHistory,
        visits,
        orders,
        payments,
        feedback,
        images,
      },
      lastSyncTime: lastSync,
    };
  }

  // Get last sync time for user
  async getLastSyncTime(userId) {
    const models = [Attendance, GpsHistory, Visit, Order, Payment, Feedback, Image];
    const syncTimes = [];

    for (const Model of models) {
      const record = await Model.findOne({
        where: { userId },
        order: [['syncedAt', 'DESC']],
        attributes: ['syncedAt'],
      });
      if (record && record.syncedAt) {
        syncTimes.push(new Date(record.syncedAt));
      }
    }

    if (syncTimes.length === 0) return null;
    return new Date(Math.max(...syncTimes));
  }
}

module.exports = new SyncService();
