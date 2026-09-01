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
router.post('/createRequest', leaveAppController.createRequest.bind(leaveAppController)); // It submit request based on leaveType (e.g., EL, CL, SL) which is part of phase 2 so this API is not used for now
router.post('/submitRequest', leaveAppController.submitRequest.bind(leaveAppController));
router.post('/cancelRequest', leaveAppController.cancelRequest.bind(leaveAppController));
router.post('/withdrawRequest', leaveAppController.withdrawRequest.bind(leaveAppController));

// Version 1 APIs for leave requests
router.post('/createRequestV1', leaveAppController.createRequestV1.bind(leaveAppController));
router.post('/cancelRequestV1', leaveAppController.cancelRequestV1.bind(leaveAppController));
router.post('/getHolidaysV1', leaveAppController.getHolidaysV1.bind(leaveAppController));

export default router;
