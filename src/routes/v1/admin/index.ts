import { Router } from 'express';
import rateLimitConfig from '../../../config/rateLimit';
import { authMiddleware, requireAdminRole } from '../../../shared/middleware/auth.middleware';
import { requireAdminCsrfToken } from '../../../shared/middleware/csrf.middleware';
import adminAuthController from '../../../modules/admin/controllers/auth.controller';
import userRoutes from './users.routes';
import productRoutes from './products.routes';
import customerRoutes from './customers.routes';
import reportRoutes from './reports.routes';
import inquiryRoutes from './inquiries.routes';
import dashboardRoutes from './dashboard.routes';
import aiRoutes from './ai.routes'; 
import { apiLogRouteContext } from '../../../modules/api-logs';

const router = Router();

router.post('/login', apiLogRouteContext('admin', 'auth'), rateLimitConfig.auth, adminAuthController.login.bind(adminAuthController));
router.post('/refresh', apiLogRouteContext('admin', 'auth'), rateLimitConfig.auth, requireAdminCsrfToken, adminAuthController.refresh.bind(adminAuthController));
router.post('/logout', apiLogRouteContext('admin', 'auth'), requireAdminCsrfToken, adminAuthController.logout.bind(adminAuthController));

router.use(authMiddleware);
router.use(requireAdminRole);
router.use(requireAdminCsrfToken);

router.use(apiLogRouteContext('admin', 'users'), userRoutes);
router.use(apiLogRouteContext('admin', 'products'), productRoutes);
router.use(apiLogRouteContext('admin', 'customers'), customerRoutes);
router.use(apiLogRouteContext('admin', 'reports'), reportRoutes);
router.use(apiLogRouteContext('admin', 'inquiries'), inquiryRoutes);
router.use(apiLogRouteContext('admin', 'dashboard'), dashboardRoutes);
router.use(apiLogRouteContext('admin', 'ai'), aiRoutes);

export default router;
