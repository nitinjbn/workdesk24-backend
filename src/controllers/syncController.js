const syncService = require('../services/syncService');

class SyncController {
  // Sync attendance data
  async syncAttendance(req, res, next) {
    try {
      const userId = req.user.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: 'Records must be an array',
        });
      }

      const result = await syncService.syncAttendance(userId, records);

      res.json({
        success: true,
        message: 'Attendance synced successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Sync GPS history data
  async syncGpsHistory(req, res, next) {
    try {
      const userId = req.user.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: 'Records must be an array',
        });
      }

      const result = await syncService.syncGpsHistory(userId, records);

      res.json({
        success: true,
        message: 'GPS history synced successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Sync visits data
  async syncVisits(req, res, next) {
    try {
      const userId = req.user.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: 'Records must be an array',
        });
      }

      const result = await syncService.syncVisits(userId, records);

      res.json({
        success: true,
        message: 'Visits synced successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Sync orders data
  async syncOrders(req, res, next) {
    try {
      const userId = req.user.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: 'Records must be an array',
        });
      }

      const result = await syncService.syncOrders(userId, records);

      res.json({
        success: true,
        message: 'Orders synced successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Sync payments data
  async syncPayments(req, res, next) {
    try {
      const userId = req.user.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: 'Records must be an array',
        });
      }

      const result = await syncService.syncPayments(userId, records);

      res.json({
        success: true,
        message: 'Payments synced successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Sync feedback data
  async syncFeedback(req, res, next) {
    try {
      const userId = req.user.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: 'Records must be an array',
        });
      }

      const result = await syncService.syncFeedback(userId, records);

      res.json({
        success: true,
        message: 'Feedback synced successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Sync images data
  async syncImages(req, res, next) {
    try {
      const userId = req.user.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        return res.status(400).json({
          success: false,
          message: 'Records must be an array',
        });
      }

      const result = await syncService.syncImages(userId, records);

      res.json({
        success: true,
        message: 'Images synced successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Bulk sync all data types
  async syncAll(req, res, next) {
    try {
      const userId = req.user.id;
      const data = req.body;

      const result = await syncService.syncAll(userId, data);

      res.json({
        success: true,
        message: 'All data synced successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get updates since last sync
  async getUpdates(req, res, next) {
    try {
      const userId = req.user.id;
      const { lastSyncTime } = req.body;

      const result = await syncService.getUpdates(userId, lastSyncTime);

      res.json({
        success: true,
        message: 'Updates retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }

  // Get sync status
  async getSyncStatus(req, res, next) {
    try {
      const userId = req.user.id;

      const result = await syncService.getSyncStatus(userId);

      res.json({
        success: true,
        message: 'Sync status retrieved successfully',
        data: result,
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new SyncController();
