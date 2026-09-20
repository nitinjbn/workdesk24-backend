import { Router } from 'express';
import rateLimitConfig from '../../../config/rateLimit';
import {
  authMiddlewareSuperAdmin,
  requireSuperAdminRole,
} from '../../../shared/middleware/auth.middleware';
import { requireSuperAdminCsrfToken } from '../../../shared/middleware/csrf.middleware';
import superAdminAuthController from '../../../modules/superadmin/controllers/auth.controller';
import hostRoutes from './hosts.routes';
import { apiLogRouteContext } from '../../../modules/api-logs';

const router = Router();

router.post(
  '/login',
  apiLogRouteContext('superadmin', 'auth'),
  rateLimitConfig.auth,
  superAdminAuthController.login.bind(superAdminAuthController)
);
router.post(
  '/refresh',
  apiLogRouteContext('superadmin', 'auth'),
  rateLimitConfig.auth,
  requireSuperAdminCsrfToken,
  superAdminAuthController.refresh.bind(superAdminAuthController)
);
router.post(
  '/logout',
  apiLogRouteContext('superadmin', 'auth'),
  requireSuperAdminCsrfToken,
  superAdminAuthController.logout.bind(superAdminAuthController)
);

router.use(authMiddlewareSuperAdmin);
router.use(requireSuperAdminRole);
router.use(requireSuperAdminCsrfToken);

router.use(apiLogRouteContext('superadmin', 'hosts'), hostRoutes);

export default router;
