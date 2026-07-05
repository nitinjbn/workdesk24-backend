import { Router } from 'express';
import rateLimitConfig from '../../../config/rateLimit';
import { authMiddleware, requireAdminRole } from '../../../shared/middleware/auth.middleware';
import { requireAdminCsrfToken } from '../../../shared/middleware/csrf.middleware';
import adminAuthController from '../../../modules/admin/controllers/auth.controller';
import userRoutes from './users.routes';
import productRoutes from './products.routes';
import reportRoutes from './reports.routes';
import inquiryRoutes from './inquiries.routes';
import dashboardRoutes from './dashboard.routes';

const router = Router();

router.post('/login', rateLimitConfig.auth, adminAuthController.login.bind(adminAuthController));
router.post('/refresh', rateLimitConfig.auth, requireAdminCsrfToken, adminAuthController.refresh.bind(adminAuthController));
router.post('/logout', requireAdminCsrfToken, adminAuthController.logout.bind(adminAuthController));

router.use(authMiddleware);
router.use(requireAdminRole);
router.use(requireAdminCsrfToken);

router.use(userRoutes);
router.use(productRoutes);
router.use(reportRoutes);
router.use(inquiryRoutes);
router.use(dashboardRoutes);

export default router;
