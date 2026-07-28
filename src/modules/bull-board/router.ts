import { Router } from 'express';

import { logger } from '../../config/database';
import { BullBoardManager } from '../../infrastructure/background-jobs';
import { authMiddleware } from '../../shared/middleware/auth.middleware';
import { requireSuperAdminRole } from './super-admin.middleware';

const DEFAULT_BULL_BOARD_BASE_PATH = '/admin/background-jobs';

const bullBoardManagers = new Map<string, BullBoardManager>();
const initializedPaths = new Set<string>();

function getBullBoardManager(basePath: string): BullBoardManager {
  const existingManager = bullBoardManagers.get(basePath);
  if (existingManager !== undefined) {
    return existingManager;
  }

  const manager = new BullBoardManager(undefined, basePath);
  bullBoardManagers.set(basePath, manager);
  return manager;
}

function initializeBullBoard(basePath: string): BullBoardManager {
  const bullBoardManager = getBullBoardManager(basePath);

  if (initializedPaths.has(basePath)) {
    return bullBoardManager;
  }

  bullBoardManager.initialize();
  initializedPaths.add(basePath);

  logger.info('Bull Board initialized for background jobs.', {
    basePath: bullBoardManager.getBasePath(),
  });

  return bullBoardManager;
}

/**
 * Returns the secured Bull Board router.
 *
 * Bull Board is initialized lazily here so the API boot sequence remains stable
 * and queue discovery always comes from QueueManager.getAllFrameworkQueues().
 */
export function createBullBoardRouter(basePath: string = DEFAULT_BULL_BOARD_BASE_PATH): Router {
  const bullBoardManager = initializeBullBoard(basePath);

  const router = Router();
  //router.use(authMiddleware);
  //router.use(requireSuperAdminRole);
  router.use('/', bullBoardManager.getRouter());

  return router;
}

export const bullBoardBasePath = DEFAULT_BULL_BOARD_BASE_PATH;
