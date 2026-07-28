import { Router } from 'express';

import { logger } from '../../config/database';
import { BullBoardManager } from '../../infrastructure/background-jobs';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireSuperAdminRole } from './super-admin.middleware';

const bullBoardManager = new BullBoardManager();
let isInitialized = false;

function initializeBullBoard(): void {
  if (isInitialized) {
    return;
  }

  bullBoardManager.initialize();
  isInitialized = true;

  logger.info('Bull Board initialized for background jobs.', {
    basePath: bullBoardManager.getBasePath(),
  });
}

/**
 * Returns the secured Bull Board router.
 *
 * Bull Board is initialized lazily here so the API boot sequence remains stable
 * and queue discovery always comes from QueueManager.getAllFrameworkQueues().
 */
export function createBullBoardRouter(): Router {
  initializeBullBoard();

  const router = Router();
  router.use(authMiddleware);
  router.use(requireSuperAdminRole);
  router.use('/', bullBoardManager.getRouter());

  return router;
}

export const bullBoardBasePath = bullBoardManager.getBasePath();
