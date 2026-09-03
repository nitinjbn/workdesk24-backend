import { Response, NextFunction } from 'express';
import holidayCalendarService from '../services/holiday-calendar.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';

export class HolidayCalendarController {
  async getHolidayCalendars(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { filter, page, limit, sortBy, sortOrder } = req.body;

      const result = await holidayCalendarService.getHolidayCalendars({
        hostId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Holiday calendars retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getHolidayCalendarById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayCalendarId } = req.body;

      if (!holidayCalendarId) {
        res.status(400).json({
          success: false,
          message: 'Holiday calendar ID is required',
        } as ApiResponse);
        return;
      }

      const result = await holidayCalendarService.getHolidayCalendarById({
        hostId,
        holidayCalendarId,
      });

      res.json({
        success: true,
        message: 'Holiday calendar retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createHolidayCalendar(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { leaveYearId=0, name, description, isDefault } = req.body;

      const result = await holidayCalendarService.createHolidayCalendar({
        hostId,
        leaveYearId,
        name,
        description,
        isDefault,
      });

      res.json({
        success: true,
        message: 'Holiday calendar created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateHolidayCalendar(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayCalendarId, name, description, isEnabled } = req.body;

      if (!holidayCalendarId) {
        res.status(400).json({
          success: false,
          message: 'Holiday calendar ID is required',
        } as ApiResponse);
        return;
      }

      const result = await holidayCalendarService.updateHolidayCalendar({
        hostId,
        holidayCalendarId,
        name,
        description,
        isEnabled,
      });

      res.json({
        success: true,
        message: 'Holiday calendar updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async enableDisableHolidayCalendar(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayCalendarId, isEnabled } = req.body;

      if (!holidayCalendarId || isEnabled === undefined) {
        res.status(400).json({
          success: false,
          message: 'Holiday calendar ID and isEnabled flag are required',
        } as ApiResponse);
        return;
      }

      const result = await holidayCalendarService.enableDisableHolidayCalendar({
        hostId,
        holidayCalendarId,
        isEnabled,
      });

      res.json({
        success: true,
        message: `Holiday calendar ${isEnabled ? 'enabled' : 'disabled'} successfully`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async setHolidayCalendarAsDefault(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayCalendarId } = req.body;

      if (!holidayCalendarId) {
        res.status(400).json({
          success: false,
          message: 'Holiday calendar ID is required',
        } as ApiResponse);
        return;
      }

      const result = await holidayCalendarService.setHolidayCalendarAsDefault({
        hostId,
        holidayCalendarId,
      });

      res.json({
        success: true,
        message: 'Holiday calendar set as default successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteHolidayCalendar(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayCalendarId } = req.body;

      if (!holidayCalendarId) {
        res.status(400).json({
          success: false,
          message: 'Holiday calendar ID is required',
        } as ApiResponse);
        return;
      }

      const result = await holidayCalendarService.deleteHolidayCalendar({
        hostId,
        holidayCalendarId,
      });

      res.json({
        success: true,
        message: 'Holiday calendar deleted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new HolidayCalendarController();
