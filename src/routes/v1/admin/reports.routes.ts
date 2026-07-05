import { Router } from 'express';
import reportController from '../../../modules/reporting/controllers/report.controller';

const router = Router();

router.post('/reports/getGPSHistory', reportController.getAdminGpsHistory.bind(reportController));
router.post('/reports/getAttendance', reportController.getAdminAttendance.bind(reportController));

export default router;
