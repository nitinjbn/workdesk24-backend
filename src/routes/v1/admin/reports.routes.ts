import { Router } from 'express';
import reportController from '../../../modules/reporting/controllers/report.controller';

const router = Router();

router.post('/reports/getGPSHistory', reportController.getAdminGpsHistory.bind(reportController));
router.post('/reports/getGPSHistory/journey', reportController.getAdminGpsHistoryJourney.bind(reportController));

router.post('/reports/getAttendance', reportController.getAdminAttendance.bind(reportController));
router.post('/reports/getVisits', reportController.getVisits.bind(reportController));
router.post('/reports/getOrders', reportController.getOrders.bind(reportController));
router.post('/reports/getPayments', reportController.getPayments.bind(reportController));
router.post('/reports/getFeedbacks', reportController.getFeedbacks.bind(reportController));
router.post('/reports/getImages', reportController.getImages.bind(reportController));

export default router;
