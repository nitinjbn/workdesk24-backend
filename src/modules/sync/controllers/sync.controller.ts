import { Response, NextFunction } from 'express';
import syncService from '../services/sync.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import cloudinary from '../../../config/cloudinary';

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

  private getResourceType(mimeType: string): string {
    if (mimeType.startsWith('image/')) {
      return 'image';
    } else if (mimeType.startsWith('video/')) {
      return 'video';
    } else if (mimeType.startsWith('audio/')) {
      return 'video'; // Treat audio as video for Cloudinary
    } else {
      return 'auto'; // Let cloudinary handle
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

      const result = await new Promise<any>((resolve, reject) => {
        const uploadStream = cloudinary.uploader.upload_stream(
          { folder: 'uploads', resource_type: this.getResourceType(file.mimetype) },
          (error: any, uploadResult: any) => {
            if (error) {
              reject(error);
              return;
            }
            resolve(uploadResult);
          }
        );

        uploadStream.end(file.buffer);
      });

      res.json({
        success: true,
        message: 'Media uploaded successfully',
        data: {
          url: result.secure_url,
          public_id: result.public_id,
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

      const uploadResults = await Promise.allSettled(files.map(file => {
        return new Promise<any>((resolve, reject) => {
          const uploadStream = cloudinary.uploader.upload_stream(
            { folder: 'uploads', resource_type: this.getResourceType(file.mimetype) },
            (error: any, uploadResult: any) => {
              if (error) {
                reject(error);
                return;
              }
              resolve(uploadResult);
            }
          );

          uploadStream.end(file.buffer);
        });
      }));

      const successfulUploads = uploadResults
        .filter((result): result is PromiseFulfilledResult<any> => result.status === 'fulfilled')
        .map(result => ({
          url: result.value.secure_url,
          public_id: result.value.public_id,
        }));

      const failedUploads = uploadResults
        .filter((result): result is PromiseRejectedResult => result.status === 'rejected')
        .map(result => ({
          error: result.reason?.message || String(result.reason),
        }));

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
}

export default new SyncController();
