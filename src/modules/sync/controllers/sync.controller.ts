import { Response, NextFunction } from 'express';
import syncService from '../services/sync.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import {
  uploadBufferToMediaStorage,
  uploadManyBuffersToMediaStorage,
} from '../../../shared/utils/media-storage.util';

export class SyncController {
  async syncAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        res.status(400).json({
          success: false,
          message: 'Records must be an array',
        } as ApiResponse);
        return;
      }

      const result = await syncService.syncAttendance(userId, records);

      res.json({
        success: true,
        message: 'Attendance synced successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async syncGpsHistory(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        res.status(400).json({
          success: false,
          message: 'Records must be an array',
        } as ApiResponse);
        return;
      }

      const result = await syncService.syncGpsHistory(userId, records);

      res.json({
        success: true,
        message: 'GPS history synced successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async syncVisits(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        res.status(400).json({
          success: false,
          message: 'Records must be an array',
        } as ApiResponse);
        return;
      }

      const result = await syncService.syncVisits(userId, records);

      res.json({
        success: true,
        message: 'Visits synced successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async syncOrders(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        res.status(400).json({
          success: false,
          message: 'Records must be an array',
        } as ApiResponse);
        return;
      }

      const result = await syncService.syncOrders(userId, records);

      res.json({
        success: true,
        message: 'Orders synced successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async syncPayments(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        res.status(400).json({
          success: false,
          message: 'Records must be an array',
        } as ApiResponse);
        return;
      }

      const result = await syncService.syncPayments(userId, records);

      res.json({
        success: true,
        message: 'Payments synced successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async syncFeedback(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        res.status(400).json({
          success: false,
          message: 'Records must be an array',
        } as ApiResponse);
        return;
      }

      const result = await syncService.syncFeedback(userId, records);

      res.json({
        success: true,
        message: 'Feedback synced successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async syncImages(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { records } = req.body;

      if (!Array.isArray(records)) {
        res.status(400).json({
          success: false,
          message: 'Records must be an array',
        } as ApiResponse);
        return;
      }

      const result = await syncService.syncImages(userId, records);

      res.json({
        success: true,
        message: 'Images synced successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async syncAll(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const data = req.body;

      const result = await syncService.syncAll(userId, data);

      res.json({
        success: true,
        message: 'All data synced successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getUpdates(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { lastSyncTime } = req.body;

      const result = await syncService.getUpdates(userId, lastSyncTime);

      res.json({
        success: true,
        message: 'Updates retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getSyncStatus(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;

      const result = await syncService.getSyncStatus(userId);

      res.json({
        success: true,
        message: 'Sync status retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async uploadMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const file = req.file as Express.Multer.File | undefined;

      if (!file) {
        res.status(400).json({
          success: false,
          message: 'Media file is required',
        } as ApiResponse);
        return;
      }

      const result = await uploadBufferToMediaStorage(file, 'uploads');

      res.json({
        success: true,
        message: 'Media uploaded successfully',
        data: {
          url: result.url,
          public_id: result.fileId,
        },
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error uploading media',
        error: error.message,
      } as ApiResponse);
    }
  }

  async uploadMultipleMedia(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const files = req.files as Express.Multer.File[] | undefined;

      if (!files || files.length === 0) {
        res.status(400).json({
          success: false,
          message: 'At least one media file is required',
        } as ApiResponse);
        return;
      }

      const uploadResults = await uploadManyBuffersToMediaStorage(files, 'uploads');
      const successfulUploads = uploadResults.successful.map((result) => ({
        url: result.url,
        public_id: result.fileId,
      }));
      const failedUploads = uploadResults.failed;

      if (failedUploads.length > 0) {
        res.status(500).json({
          success: false,
          message: 'One or more media uploads failed',
          data: successfulUploads,
          errors: failedUploads,
        } as ApiResponse);
        return;
      }

      res.json({
        success: true,
        message: 'Media uploaded successfully',
        data: successfulUploads,
      } as ApiResponse);
    } catch (error: any) {
      res.status(500).json({
        success: false,
        message: 'Error uploading media',
        error: error.message,
      } as ApiResponse);
    }
  }

  async getCustomers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { hostId } = req.body;

      const result = await syncService.getCustomers({hostId, userId});

      res.json({
        success: true,
        message: 'Customers retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getProducts(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { hostId } = req.body;

      const result = await syncService.getProducts({hostId, userId});

      res.json({
        success: true,
        message: 'Products retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getUserSettings(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      
      const { hostId, userId } = req.body;
      if (!hostId || !userId) {
        res.status(400).json({
          success: false,
          message: 'hostId and userId are required',
        } as ApiResponse);
        return;
      }

      const result = await syncService.getUserDetails({hostId, userId});

      res.json({
        success: true,
        message: 'User settings retrieved successfully',
        data: {
          user: result || {},
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new SyncController();
