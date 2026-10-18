import { Response, NextFunction } from 'express';
import hostService from '../services/host.service';
import { ApiResponse } from '../../../shared/types/base.types';
import { AuthRequest } from '../../../shared/types/auth.types';

export class HostController {
  async getHostFeatures(req: AuthRequest, res: Response, next: NextFunction): Promise<void> {
    try {
      console.log("request user:", req.user);
      const hostId = req.user?.hostId || req.body?.hostId;

      if (!hostId) {
        res.status(400).json({
          success: false,
          message: 'hostId must be a positive integer',
          data: null,
        } satisfies ApiResponse);
        return;
      }

      const result = await hostService.getHostEnabledFeatures(hostId);

      res.json({
        success: true,
        message: 'Host features fetched successfully',
        data: result,
      } satisfies ApiResponse<typeof result>);
    } catch (error) {
      next(error);
    }
  }
}

export default new HostController();
