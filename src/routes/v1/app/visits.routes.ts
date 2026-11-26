import { Router } from 'express';
import visitPlanController from '../../../modules/staff/controllers/visit-plan.controller';

const router = Router();

router.post('/schedule', visitPlanController.schedule.bind(visitPlanController));
router.post('/reschedule', visitPlanController.reschedule.bind(visitPlanController));
router.post('/today', visitPlanController.today.bind(visitPlanController));
router.post('/upcoming', visitPlanController.upcoming.bind(visitPlanController));
router.post('/overdue', visitPlanController.overdue.bind(visitPlanController));
router.post('/customerHistory', visitPlanController.customerHistory.bind(visitPlanController));
router.post('/details', visitPlanController.details.bind(visitPlanController));
router.post('/cancel', visitPlanController.cancel.bind(visitPlanController));

export default router;
