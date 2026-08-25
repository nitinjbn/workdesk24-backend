import { Router } from 'express';
import leaveAppController from '../../../modules/leave/controllers/leave-app.controller';

const router = Router();

router.post('/getSummary', leaveAppController.getSummary.bind(leaveAppController));
router.post('/getBalances', leaveAppController.getBalances.bind(leaveAppController));
router.post('/getBalancesByLeaveYear', leaveAppController.getBalancesByLeaveYear.bind(leaveAppController));
router.post('/getLeaveTypes', leaveAppController.getLeaveTypes.bind(leaveAppController));
router.post('/getHolidays', leaveAppController.getHolidays.bind(leaveAppController));
router.post('/getRequests', leaveAppController.getRequests.bind(leaveAppController));
router.post('/getRequestById', leaveAppController.getRequestById.bind(leaveAppController));
router.post('/createRequest', leaveAppController.createRequest.bind(leaveAppController));
router.post('/submitRequest', leaveAppController.submitRequest.bind(leaveAppController));
router.post('/cancelRequest', leaveAppController.cancelRequest.bind(leaveAppController));
router.post('/withdrawRequest', leaveAppController.withdrawRequest.bind(leaveAppController));

export default router;
