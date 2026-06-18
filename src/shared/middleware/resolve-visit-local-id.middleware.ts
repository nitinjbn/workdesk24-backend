import { Response, NextFunction } from 'express';
import { AuthRequest } from '../types/auth.types';
import { resolveVisitLocalIdsForRecords } from '../utils/visit-local-id-resolver';

export function resolveVisitLocalId(...bodyKeys: string[]) {
  return async (req: AuthRequest, res: Response, next: NextFunction): Promise<void> => {
    try {
      const userId = req.user!.id;
      const keys = bodyKeys.length ? bodyKeys : ['records'];

      for (const key of keys) {
        const records = req.body?.[key];

        if (Array.isArray(records)) {
          await resolveVisitLocalIdsForRecords(userId, records);
        }
      }

      next();
    } catch (error: any) {
      res.status(400).json({
        success: false,
        message: error.message,
      });
    }
  };
}
