import { Router } from 'express';
import leaveYearController from '../../../modules/leave/controllers/leave-year.controller';
import holidayCalendarController from '../../../modules/leave/controllers/holiday-calendar.controller';
import holidayController from '../../../modules/leave/controllers/holiday.controller';
import leaveTypeController from '../../../modules/leave/controllers/leave-type.controller';
import leavePolicyController from '../../../modules/leave/controllers/leave-policy.controller';
import employeeLeaveConfigController from '../../../modules/leave/controllers/employee-leave-config.controller';
import leaveBalanceController from '../../../modules/leave/controllers/leave-balance.controller';
import leaveRequestApprovalController from '../../../modules/leave/controllers/leave-request-approval.controller';

const router = Router();

// Leave Year APIs
router.post('/getLeaveYears', leaveYearController.getLeaveYears.bind(leaveYearController));
router.post('/getLeaveYearById', leaveYearController.getLeaveYearById.bind(leaveYearController));
router.post('/createLeaveYear', leaveYearController.createLeaveYear.bind(leaveYearController));
router.post('/updateLeaveYear', leaveYearController.updateLeaveYear.bind(leaveYearController));
router.post('/deleteLeaveYear', leaveYearController.deleteLeaveYear.bind(leaveYearController));

// Holiday Calendar APIs
router.post('/getHolidayCalendars', holidayCalendarController.getHolidayCalendars.bind(holidayCalendarController));
router.post('/getHolidayCalendarById', holidayCalendarController.getHolidayCalendarById.bind(holidayCalendarController));
router.post('/createHolidayCalendar', holidayCalendarController.createHolidayCalendar.bind(holidayCalendarController));
router.post('/updateHolidayCalendar', holidayCalendarController.updateHolidayCalendar.bind(holidayCalendarController));
router.post('/enableDisableHolidayCalendar', holidayCalendarController.enableDisableHolidayCalendar.bind(holidayCalendarController));
router.post('/setHolidayCalendarAsDefault', holidayCalendarController.setHolidayCalendarAsDefault.bind(holidayCalendarController));
router.post('/deleteHolidayCalendar', holidayCalendarController.deleteHolidayCalendar.bind(holidayCalendarController));

// Holiday APIs
router.post('/getHolidaysByCalendar', holidayController.getHolidaysByCalendar.bind(holidayController));
router.post('/getHolidayById', holidayController.getHolidayById.bind(holidayController));
router.post('/createHoliday', holidayController.createHoliday.bind(holidayController));
router.post('/updateHoliday', holidayController.updateHoliday.bind(holidayController));
router.post('/enableDisableHoliday', holidayController.enableDisableHoliday.bind(holidayController));
router.post('/deleteHoliday', holidayController.deleteHoliday.bind(holidayController));
router.post('/bulkCreateHolidays', holidayController.bulkCreateHolidays.bind(holidayController));

// Leave Type APIs
router.post('/getLeaveTypes', leaveTypeController.getLeaveTypes.bind(leaveTypeController));
router.post('/getLeaveTypeById', leaveTypeController.getLeaveTypeById.bind(leaveTypeController));
router.post('/createLeaveType', leaveTypeController.createLeaveType.bind(leaveTypeController));
router.post('/updateLeaveType', leaveTypeController.updateLeaveType.bind(leaveTypeController));
router.post('/enableDisableLeaveType', leaveTypeController.enableDisableLeaveType.bind(leaveTypeController));
router.post('/deleteLeaveType', leaveTypeController.deleteLeaveType.bind(leaveTypeController));

// Leave Policy APIs
router.post('/createLeavePolicy', leavePolicyController.createLeavePolicy.bind(leavePolicyController));
router.post('/getLeavePolicies', leavePolicyController.getLeavePolicies.bind(leavePolicyController));
router.post('/getLeavePolicyById', leavePolicyController.getLeavePolicyById.bind(leavePolicyController));
router.post('/updateLeavePolicy', leavePolicyController.updateLeavePolicy.bind(leavePolicyController));
router.post('/enableDisableLeavePolicy', leavePolicyController.enableDisableLeavePolicy.bind(leavePolicyController));
router.post('/deleteLeavePolicy', leavePolicyController.deleteLeavePolicy.bind(leavePolicyController));
router.post('/setLeavePolicyAsDefault', leavePolicyController.setLeavePolicyAsDefault.bind(leavePolicyController));

// Leave Policy Rule APIs
router.post('/addLeaveTypeRule', leavePolicyController.addLeaveTypeRule.bind(leavePolicyController));
router.post('/updateLeaveTypeRule', leavePolicyController.updateLeaveTypeRule.bind(leavePolicyController));
router.post('/deleteLeaveTypeRule', leavePolicyController.deleteLeaveTypeRule.bind(leavePolicyController));
router.post('/getLeavePolicyRules', leavePolicyController.getLeavePolicyRules.bind(leavePolicyController));

// Employee Leave Configuration APIs
router.post('/getEmployeeLeaveConfiguration', employeeLeaveConfigController.getEmployeeLeaveConfiguration.bind(employeeLeaveConfigController));
router.post('/updateEmployeeLeaveConfiguration', employeeLeaveConfigController.updateEmployeeLeaveConfiguration.bind(employeeLeaveConfigController));
router.post('/bulkUpdateEmployeeLeaveConfiguration', employeeLeaveConfigController.bulkUpdateEmployeeLeaveConfiguration.bind(employeeLeaveConfigController));

// Leave Balance APIs
router.post('/getEmployeeLeaveBalances', leaveBalanceController.getEmployeeLeaveBalances.bind(leaveBalanceController));
router.post('/getEmployeeBalanceForLeaveYear', leaveBalanceController.getEmployeeBalanceForLeaveYear.bind(leaveBalanceController));
router.post('/getBalanceByLeaveType', leaveBalanceController.getBalanceByLeaveType.bind(leaveBalanceController));
router.post('/getBalanceTransactionHistory', leaveBalanceController.getBalanceTransactionHistory.bind(leaveBalanceController));
router.post('/manualBalanceAdjustment', leaveBalanceController.manualBalanceAdjustment.bind(leaveBalanceController));

// Leave Request Approval APIs
router.post('/getPendingLeaveRequests', leaveRequestApprovalController.listPendingLeaveRequests.bind(leaveRequestApprovalController));
router.post('/getLeaveRequestDetails', leaveRequestApprovalController.getLeaveRequestDetails.bind(leaveRequestApprovalController));
router.post('/approveLeaveRequest', leaveRequestApprovalController.approveLeaveRequest.bind(leaveRequestApprovalController));
router.post('/rejectLeaveRequest', leaveRequestApprovalController.rejectLeaveRequest.bind(leaveRequestApprovalController));
router.post('/cancelLeaveRequestByApprover', leaveRequestApprovalController.cancelLeaveRequest.bind(leaveRequestApprovalController));
router.post('/getLeaveRequestApprovalHistory', leaveRequestApprovalController.viewApprovalHistory.bind(leaveRequestApprovalController));

// Version 1 APIs for leave requests
router.post('/approveLeaveRequestV1', leaveRequestApprovalController.approveLeaveRequestV1.bind(leaveRequestApprovalController));
router.post('/rejectLeaveRequestV1', leaveRequestApprovalController.rejectLeaveRequestV1.bind(leaveRequestApprovalController));

export default router;
