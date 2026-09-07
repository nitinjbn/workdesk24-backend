import { Response, NextFunction } from 'express';
import geoFencingService from '../services/geo-fencing.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';
import GeoFencingValidator from '../helpers/geo-fencing.validator';

export class GeoFencingController {
  async getAttendanceLocations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceLocationPayload('GET_LIST', req.body);

      const { hostId, filter, page, limit, sorting } = req.body;

      const result = await geoFencingService.getAttendanceLocations(
        { hostId, filter, page, limit, sorting },
        { hostId: req.user!.hostId }
      );
      res.json({
        success: true,
        message: 'Attendance locations retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createAttendanceLocation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceLocationPayload('CREATE', req.body);

      const { hostId, latitude, longitude, radiusMeters, locationName, isEnabled, siteUsers } =
        req.body;

      const result = await geoFencingService.createAttendanceLocation({
        hostId,
        latitude,
        longitude,
        radiusMeters,
        locationName,
        isEnabled,
        siteUsers,
      });
      res.json({
        success: true,
        message: 'Attendance location created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateAttendanceLocation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceLocationPayload('UPDATE', req.body);

      const {
        hostId,
        attendanceLocationId,
        latitude,
        longitude,
        radiusMeters,
        locationName,
        isEnabled,
        siteUsers,
      } = req.body;

      const result = await geoFencingService.updateAttendanceLocation({
        hostId,
        attendanceLocationId,
        latitude,
        longitude,
        radiusMeters,
        locationName,
        isEnabled,
        siteUsers,
      });
      res.json({
        success: true,
        message: 'Attendance location updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getAttendanceLocationById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceLocationPayload('GET_BY_ID', req.body);

      const { hostId, attendanceLocationId } = req.body;
      const result = await geoFencingService.getAttendanceLocationById({
        hostId,
        attendanceLocationId,
        includeSiteUsers: true,
      });
      res.json({
        success: true,
        message: 'Attendance location retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteAttendanceLocation(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      // Validate the payload before proceeding
      GeoFencingValidator.validateAttendanceLocationPayload('DELETE', req.body);

      const { hostId, attendanceLocationId } = req.body;
      const result = await geoFencingService.deleteAttendanceLocation({
        hostId,
        attendanceLocationId,
      });
      res.json({
        success: true,
        message: 'Attendance location deleted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new GeoFencingController();
