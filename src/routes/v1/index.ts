import { Router } from 'express';
import authRoutes from './auth';
import publicRoutes from './public';
import appRoutes from './app';
import adminRoutes from './admin';
import { bullBoardBasePath, createBullBoardRouter } from '../../modules/bull-board';
import { apiLogRouteContext } from '../../modules/api-logs';

const router = Router();

// All v1 API routes
router.use('/auth', apiLogRouteContext('auth', 'auth'), authRoutes);
router.use('/app', apiLogRouteContext('app', 'app'), appRoutes);
router.use('/admin', apiLogRouteContext('admin', 'admin'), adminRoutes);
router.use('/public', apiLogRouteContext('public', 'public'), publicRoutes);

// Routes
router.use(bullBoardBasePath, createBullBoardRouter(bullBoardBasePath));
router.use('/background-jobs', createBullBoardRouter('/background-jobs'));

export default router;
