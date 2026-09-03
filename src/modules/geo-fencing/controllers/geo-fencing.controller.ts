import { Response, NextFunction } from 'express';
import geoFencingService from '../services/geo-fencing.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';

export class GeoFencingController {

  async getAttendanceLocations(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, filter, page, limit, sorting } = req.body;
    try {
      const result = await geoFencingService.getAttendanceLocations({ hostId, filter, page, limit, sorting }, { hostId: req.user!.hostId });
      res.json({
        success: true,
        message: 'Attendance locations retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createAttendanceLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, latitude, longitude, radiusMeters, locationName, isEnabled } = req.body;
    try {
      const result = await geoFencingService.createAttendanceLocation({ hostId, latitude, longitude, radiusMeters, locationName, isEnabled });
      res.json({
        success: true,
        message: 'Attendance location created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }


  async updateAttendanceLocation(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    const { hostId, attendanceLocationId, latitude, longitude, radiusMeters, locationName, isEnabled } = req.body;
    try {
      const result = await geoFencingService.updateAttendanceLocation({ hostId, attendanceLocationId, latitude, longitude, radiusMeters, locationName, isEnabled });
      res.json({
        success: true,
        message: 'Attendance location updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new GeoFencingController();