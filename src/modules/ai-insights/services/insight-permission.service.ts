import db from '../../../models';
import { createConfiguredError } from '../../../shared/utils/error.util';

export class InsightPermissionService {

  async validateAccess(params: {
    hostId: number;
    userId: number;
  }): Promise<void> {

    const {
      hostId,
      userId
    } = params;

    if (!hostId) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'Host context is required',
        400,
        'VALIDATION_ERROR'
      );
    }

    if (!userId) {
      throw createConfiguredError(
        'VALIDATION_ERROR',
        'User context is required',
        400,
        'VALIDATION_ERROR'
      );
    }

    const user = await db.User.findOne({
      where: {
        id: userId,
        hostId,
        isDeleted: 0
      },
      attributes: ['id']
    });

    if (!user) {
      throw createConfiguredError(
        'ACCESS_DENIED',
        'You are not allowed to access this host data',
        403,
        'ACCESS_DENIED'
      );
    }
  }

  async validateInsightAccess(params: {
    hostId: number;
    userId: number;
    insightId: string;
  }): Promise<void> {

    await this.validateAccess({
      hostId: params.hostId,
      userId: params.userId
    });
  }
}