import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { resolveVisitLocalId } from '../../../shared/middleware/resolve-visit-local-id.middleware';
import { AuthRequest } from '../../../types';
import syncController from '../../../modules/sync/controllers/sync.controller';
import reportController from '../../../modules/reporting/controllers/report.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);

router.post('/sync/attendance', syncController.syncAttendance.bind(syncController));
router.post('/sync/gps-history', syncController.syncGpsHistory.bind(syncController));
router.post('/sync/visits', syncController.syncVisits.bind(syncController));
router.post('/sync/orders', resolveVisitLocalId(), syncController.syncOrders.bind(syncController));
router.post('/sync/payments', resolveVisitLocalId(), syncController.syncPayments.bind(syncController));
router.post('/sync/feedback', resolveVisitLocalId(), syncController.syncFeedback.bind(syncController));
router.post('/sync/images', resolveVisitLocalId(), syncController.syncImages.bind(syncController));
router.post('/sync/all', syncController.syncAll.bind(syncController));
router.post('/sync/get-updates', syncController.getUpdates.bind(syncController));
router.post('/sync/status', syncController.getSyncStatus.bind(syncController));
router.post('/reports/getGPSHistory', reportController.getAppGpsHistory.bind(reportController));
router.post('/reports/getAttendance', reportController.getAppAttendance.bind(reportController));

router.post('/sync/uploadMedia', upload.single('media'), syncController.uploadMedia.bind(syncController));
router.post('/sync/uploadMultipleMedia', upload.array('media', 10), syncController.uploadMultipleMedia.bind(syncController));

router.post('/profile/get', (req: AuthRequest, res) => {
  res.json({
    success: true,
    message: 'Profile retrieved successfully',
    data: req.user,
  });
});

export default router;
