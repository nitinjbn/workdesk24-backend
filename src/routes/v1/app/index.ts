import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import syncController from '../../../modules/sync/controllers/sync.controller';

const router = Router();

router.use(authMiddleware);

router.post('/sync/attendance', syncController.syncAttendance.bind(syncController));
router.post('/sync/gps-history', syncController.syncGpsHistory.bind(syncController));
router.post('/sync/visits', syncController.syncVisits.bind(syncController));
router.post('/sync/orders', syncController.syncOrders.bind(syncController));
router.post('/sync/payments', syncController.syncPayments.bind(syncController));
router.post('/sync/feedback', syncController.syncFeedback.bind(syncController));
router.post('/sync/images', syncController.syncImages.bind(syncController));
router.post('/sync/all', syncController.syncAll.bind(syncController));
router.post('/sync/get-updates', syncController.getUpdates.bind(syncController));
router.post('/sync/status', syncController.getSyncStatus.bind(syncController));

router.post('/profile/get', (req, res) => {
  res.json({
    success: true,
    message: 'Profile retrieved successfully',
    data: req.user,
  });
});

export default router;
