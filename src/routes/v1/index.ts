import { Router } from 'express';
import authRoutes from './auth';
import publicRoutes from './public';
import appRoutes from './app';
import adminRoutes from './admin';
import { bullBoardBasePath, createBullBoardRouter } from '../../modules/bull-board';

const router = Router();

// All v1 API routes
router.use('/auth', authRoutes);
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

// Routes
router.use(bullBoardBasePath, createBullBoardRouter(bullBoardBasePath));
router.use('/background-jobs', createBullBoardRouter('/background-jobs'));

console.log(router);

export default router;
