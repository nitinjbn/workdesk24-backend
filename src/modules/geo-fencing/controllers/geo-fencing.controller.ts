import { Response, NextFunction } from 'express';
import geoFencingService from '../services/geo-fencing.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import GeoFencingValidator from '../helpers/geo-fencing.validator';

export class GeoFencingController {
  async getAttendanceSites(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceSitePayload('GET_LIST', req.body);

      const { hostId, filter, page, limit, sorting } = req.body;

      const result = await geoFencingService.getAttendanceSites(
        { hostId, filter, page, limit, sorting },
        { hostId: req.user!.hostId }
      );
      res.json({
        success: true,
        message: 'Attendance sites retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createAttendanceSite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceSitePayload('CREATE', req.body);

      const { hostId, latitude, longitude, radiusMeters, siteName, isEnabled, siteUsers } =
        req.body;

      const result = await geoFencingService.createAttendanceSite({
        hostId,
        latitude,
        longitude,
        radiusMeters,
        siteName,
        isEnabled,
        siteUsers,
      });
      res.json({
        success: true,
        message: 'Attendance site created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateAttendanceSite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceSitePayload('UPDATE', req.body);

      const {
        hostId,
        attendanceSiteId,
        latitude,
        longitude,
        radiusMeters,
        siteName,
        isEnabled,
        siteUsers,
      } = req.body;

      const result = await geoFencingService.updateAttendanceSite({
        hostId,
        attendanceSiteId,
        latitude,
        longitude,
        radiusMeters,
        siteName,
        isEnabled,
        siteUsers,
      });
      res.json({
        success: true,
        message: 'Attendance site updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceSiteById(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceSitePayload('GET_BY_ID', req.body);

      const { hostId, attendanceSiteId } = req.body;
      const result = await geoFencingService.getAttendanceSiteById({
        hostId,
        attendanceSiteId,
        includeSiteUsers: true,
      });
      res.json({
        success: true,
        message: 'Attendance site retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteAttendanceSite(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceSitePayload('DELETE', req.body);

      const { hostId, attendanceSiteId } = req.body;
      const result = await geoFencingService.deleteAttendanceSite({
        hostId,
        attendanceSiteId,
      });
      res.json({
        success: true,
        message: 'Attendance site deleted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new GeoFencingController();
