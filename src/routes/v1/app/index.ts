import { Router } from 'express';
import multer from 'multer';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import { resolveVisitLocalId } from '../../../shared/middleware/resolve-visit-local-id.middleware';
import { AuthRequest } from '../../../types';
import syncController from '../../../modules/sync/controllers/sync.controller';
import reportController from '../../../modules/reporting/controllers/report.app.controller';
import userController from '../../../modules/master/controllers/user.controller';
import leaveRoutes from './leaves.routes';
import { apiLogRouteContext } from '../../../modules/api-logs';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.use(authMiddleware);
router.use('/sync', apiLogRouteContext('app', 'sync'));
router.use('/reports', apiLogRouteContext('app', 'reports'));
router.use('/device', apiLogRouteContext('app', 'device'));
router.use('/profile', apiLogRouteContext('app', 'profile'));
router.use('/leave', apiLogRouteContext('app', 'leave'), leaveRoutes);

// Sync related routes
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
router.post('/sync/getCustomers', syncController.getCustomers.bind(syncController));
router.post('/sync/getProducts', syncController.getProducts.bind(syncController));
router.post('/sync/uploadMedia', upload.single('media'), syncController.uploadMedia.bind(syncController));
router.post('/sync/uploadMultipleMedia', upload.array('media', 10), syncController.uploadMultipleMedia.bind(syncController));
router.post('/sync/userSettings', syncController.getUserSettings.bind(syncController));

// Report related routes
//router.post('/reports/getGPSHistory', reportController.getAppGpsHistory.bind(reportController));
router.post('/reports/getAttendance', reportController.getAttendance.bind(reportController));
router.post('/reports/getVisits', reportController.getVisits.bind(reportController));
router.post('/reports/getOrders', reportController.getOrders.bind(reportController));
router.post('/reports/getPayments', reportController.getPayments.bind(reportController));
router.post('/reports/getFeedbacks', reportController.getFeedbacks.bind(reportController));
router.post('/reports/getImages', reportController.getImages.bind(reportController));
router.post('/reports/getCustomerDetails', reportController.getCustomerDetails.bind(reportController));

// User Device related routes
router.post('/device/updateFcmToken', userController.updateFcmToken.bind(userController));

router.post('/profile/get', (req: AuthRequest, res) => {
  res.json({
    success: true,
    message: 'Profile retrieved successfully',
    data: req.user,
  });
});

export default router;
