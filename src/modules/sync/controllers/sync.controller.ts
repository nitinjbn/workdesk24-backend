import { Response, NextFunction } from 'express';
import syncService from '../services/sync.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import {
  uploadBufferToMediaStorage,
  uploadManyBuffersToMediaStorage,
} from '../../../shared/utils/media-storage.util';
import customerService from '../../master/services/customer.service';
import { revisedOrderSchema } from '../types/revised-order.schema';
import { createConfiguredError } from '../../../shared/utils/error.util';
import { deviceHealthSchema } from '../types/device-health.schema';
import deviceHealthService from '../services/device-health.service';

function safeAuthenticatedId(value: unknown): number | null {
  if (typeof value !== 'number' && (typeof value !== 'string' || !/^[1-9]\d*$/.test(value))) {
    return null;
  }
  const parsed = Number(value);
  return Number.isSafeInteger(parsed) && parsed > 0 ? parsed : null;
}

export class SyncController {
  async syncDeviceHealth(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = safeAuthenticatedId(req.user?.hostId);
      const userId = safeAuthenticatedId(req.user?.id);
      if (hostId === null || userId === null) {
        throw createConfiguredError('DEVICE_HEALTH_AUTH_REQUIRED', 'Authentication required', 401, 'AUTH_REQUIRED');
      }
      const body: unknown = req.body;
      if (body && typeof body === 'object' && 'schemaVersion' in body
        && typeof body.schemaVersion === 'number' && Number.isSafeInteger(body.schemaVersion)
        && body.schemaVersion !== 1) {
        throw createConfiguredError('DEVICE_HEALTH_UNSUPPORTED_VERSION', 'Unsupported device health schema version', 400, 'DEVICE_HEALTH_UNSUPPORTED_VERSION');
      }
      const parsed = deviceHealthSchema.safeParse(body);
      if (!parsed.success) {
        throw createConfiguredError('DEVICE_HEALTH_INVALID_PAYLOAD', 'Invalid device health payload', 400, 'DEVICE_HEALTH_INVALID_PAYLOAD');
      }

      const outcome = await deviceHealthService.sync({ hostId, id: userId }, parsed.data);
      if (outcome === 'stale' || outcome === 'ambiguous' || outcome === 'deleted') {
        const code = outcome === 'stale' ? 'DEVICE_HEALTH_STALE'
          : outcome === 'ambiguous' ? 'DEVICE_HEALTH_AMBIGUOUS' : 'DEVICE_HEALTH_DELETED';
        res.status(409).json({ success: false, code, message: 'Device health snapshot was not accepted', data: null });
        return;
      }
      res.json({
        success: true,
        message: 'Device health synced successfully',
        data: { status: outcome, sequence: parsed.data.sequence },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

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

  async revisedOrder(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = Number(req.user?.hostId);
      if (!Number.isSafeInteger(hostId) || hostId <= 0) {
        throw createConfiguredError('AUTH_REQUIRED', 'Authentication required', 401, 'AUTH_REQUIRED');
      }

      const result = revisedOrderSchema.safeParse(req.body);
      if (!result.success) {
        const issue = result.error.issues[0];
        const field = issue.path.join('.');
        throw createConfiguredError(
          'INVALID_ORDER_REVISION',
          field ? `${field}: ${issue.message}` : issue.message
        );
      }

      const order = await syncService.reviseOrder(hostId, result.data);
      res.json({ success: true, message: 'Order revised successfully', data: order });
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
          fileName: file.originalname,
          fileSizeInBytes: file.size,
          mimeType: file.mimetype,
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

      const result = await syncService.getCustomers({ hostId, userId });

      res.json({
        success: true,
        message: 'Customers retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getUsers(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const hostId = req.user?.hostId;
      if (!hostId) {
        res.status(401).json({
          success: false,
          message: 'Valid authenticated host is required',
          data: null,
        } as ApiResponse);
        return;
      }

      const result = await syncService.getUsers(hostId);

      res.json({
        success: true,
        message: 'Users retrieved successfully',
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

      const result = await syncService.getProducts({ hostId, userId });

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

      const result = await syncService.getUserDetails({ hostId, userId });

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

  async getLocationsData(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { hostId } = req.body;

      const result = await syncService.getLocationsData({ hostId, userId });

      res.json({
        success: true,
        message: 'Locations data retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getCustomerTypes(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const { hostId } = req.body;

      const result = await syncService.getCustomerTypes({ hostId });

      res.json({
        success: true,
        message: 'Customer types retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createCustomer(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const userId = req.user!.id;
      const {
        hostId,
        localId,
        customerCode,
        customerName,
        customerTypeId,
        contactPerson,
        email,
        mobile,
        alternateMobile,
        gstNumber,
        panNumber,
        addressLine1,
        addressLine2,
        city,
        stateName,
        stateIsoCode,
        postalCode,
        countryName,
        countryIsoCode,
        remarks,
        isEnabled,
        customerMedia = [],
        customerAttribute = [],
        assignedUserIds,
        latitude,
        longitude,
      } = req.body;

      const result = await customerService.createCustomer({
        hostId,
        localId,
        customerCode,
        customerName,
        customerTypeId,
        contactPerson,
        email,
        mobile,
        alternateMobile,
        gstNumber,
        panNumber,
        addressLine1,
        addressLine2,
        city,
        stateName,
        stateIsoCode,
        postalCode,
        countryName,
        countryIsoCode,
        remarks,
        isEnabled,
        customerMedia,
        customerAttribute,
        assignedUserIds: assignedUserIds || [],
        latitude,
        longitude,
        createdByUserType: 'USER',
        createdByUserId: userId,
        approvalStatus: 'PENDING',
      });

      res.json({
        success: true,
        message: 'Customer created successfully',
        data: {
          customerId: result.id,
        },
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getTodayAttendance(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, id: userId } = req.user;

      const result = await syncService.getTodayAttendance({ hostId, userId });

      res.json({
        success: true,
        message: 'Today attendance retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async checkAppVersion(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      const { hostId, id: userId } = req.user;
      const { versionCode, versionName, currentVersion, platform } = req.body;

      const resolvedVersionName = versionName ?? currentVersion ?? null;
      const parsedVersionCode = Number(versionCode);
      const resolvedVersionCode =
        Number.isFinite(parsedVersionCode) && parsedVersionCode > 0 ? parsedVersionCode : null;

      if (resolvedVersionCode === null && !resolvedVersionName) {
        res.status(400).json({
          success: false,
          message: 'versionCode or versionName is required',
        } as ApiResponse);
        return;
      }

      const result = await syncService.checkAppVersion({
        hostId,
        userId,
        versionCode: resolvedVersionCode,
        versionName: resolvedVersionName,
        platform,
      });

      res.json({
        success: true,
        message: 'App version check completed successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new SyncController();
