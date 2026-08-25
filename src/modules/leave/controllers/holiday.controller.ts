import { Response, NextFunction } from 'express';
import holidayService from '../services/holiday.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';

export class HolidayController {
  async getHolidaysByCalendar(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayCalendarId, filter, page, limit, sortBy, sortOrder } = req.body;

      if (!holidayCalendarId) {
        res.status(400).json({
          success: false,
          message: 'Holiday calendar ID is required',
        } as ApiResponse);
        return;
      }

      const result = await holidayService.getHolidaysByCalendar({
        hostId,
        holidayCalendarId,
        filter,
        page,
        limit,
        sortBy,
        sortOrder,
      });

      res.json({
        success: true,
        message: 'Holidays retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async getHolidayById(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayId } = req.body;

      if (!holidayId) {
        res.status(400).json({
          success: false,
          message: 'Holiday ID is required',
        } as ApiResponse);
        return;
      }

      const result = await holidayService.getHolidayById({
        hostId,
        holidayId,
      });

      res.json({
        success: true,
        message: 'Holiday retrieved successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async createHoliday(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayCalendarId, holidayDate, name, description, isOptional } = req.body;

      const result = await holidayService.createHoliday({
        hostId,
        holidayCalendarId,
        holidayDate,
        name,
        description,
        isOptional,
      });

      res.json({
        success: true,
        message: 'Holiday created successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async updateHoliday(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayId, holidayDate, name, description, isOptional, isEnabled } = req.body;

      if (!holidayId) {
        res.status(400).json({
          success: false,
          message: 'Holiday ID is required',
        } as ApiResponse);
        return;
      }

      const result = await holidayService.updateHoliday({
        hostId,
        holidayId,
        holidayDate,
        name,
        description,
        isOptional,
        isEnabled,
      });

      res.json({
        success: true,
        message: 'Holiday updated successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async enableDisableHoliday(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayId, isEnabled } = req.body;

      if (!holidayId || isEnabled === undefined) {
        res.status(400).json({
          success: false,
          message: 'Holiday ID and isEnabled flag are required',
        } as ApiResponse);
        return;
      }

      const result = await holidayService.enableDisableHoliday({
        hostId,
        holidayId,
        isEnabled,
      });

      res.json({
        success: true,
        message: `Holiday ${isEnabled ? 'enabled' : 'disabled'} successfully`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async deleteHoliday(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayId } = req.body;

      if (!holidayId) {
        res.status(400).json({
          success: false,
          message: 'Holiday ID is required',
        } as ApiResponse);
        return;
      }

      const result = await holidayService.deleteHoliday({
        hostId,
        holidayId,
      });

      res.json({
        success: true,
        message: 'Holiday deleted successfully',
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }

  async bulkCreateHolidays(
    req: AuthRequest,
    res: Response,
    next: NextFunction
  ): Promise<void> {
    try {
      const hostId = req.user!.hostId;
      const { holidayCalendarId, holidays } = req.body;

      const result = await holidayService.bulkCreateHolidays({
        hostId,
        holidayCalendarId,
        holidays,
      });

      res.json({
        success: true,
        message: `${result.count} holiday(ies) imported successfully`,
        data: result,
      } as ApiResponse);
    } catch (error) {
      next(error);
    }
  }
}

export default new HolidayController();
