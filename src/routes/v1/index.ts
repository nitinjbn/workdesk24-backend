import { Router } from 'express';
import authRoutes from './auth';
import publicRoutes from './public';
import appRoutes from './app';
import adminRoutes from './admin';

const router = Router();

// All v1 API routes
router.use('/auth', authRoutes);
router.use('/app', appRoutes);
router.use('/admin', adminRoutes);
router.use('/public', publicRoutes);

export default router;
