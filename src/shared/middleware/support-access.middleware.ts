import { NextFunction, Response } from 'express';
import { AuthRequest } from '../types/auth.types';

const READ_ONLY_SUPPORT_ROUTES = new Set([
  '/dashboard/overview',
  '/users/getDesignations',
  '/users/getRoles',
  '/users/getUsers',
  '/users/getUserDetails',
  '/users/checkCreateAppUserEligibility',
  '/users/validateEmail',
  '/users/validateMobile',
  '/customers/getCustomerTypes',
  '/customers/getCustomers',
  '/customers/getCustomerDetails',
  '/products/getCategories',
  '/products/getBrands',
  '/products/getUOM',
  '/products/getProducts',
  '/products/getProductDetails',
  '/products/getProductMedia',
  '/products/getProductAttributes',
  '/inquiries/list',
  '/inquiries/get',
  '/reports/getGPSHistory',
  '/reports/getGPSHistory/journey',
  '/reports/getAttendance',
  '/reports/getVisits',
  '/reports/getOrders',
  '/reports/getPayments',
  '/reports/getFeedbacks',
  '/reports/getImages',
  '/reports/getAllActivities',
  '/reports/getLastLocations',
  '/reports/getActivityTrend',
  '/reports/getMonthlyAttendance',
  '/ai-insights/categories',
  '/ai-insights/query',
  '/geo-fencing/getAttendanceSites',
  '/geo-fencing/getAttendanceSiteById',
  '/tasks/dashboard-stats',
  '/tasks/kanban-board',
  '/tasks/getTasks',
  '/tasks/getTaskDetails',
  '/tasks/getTaskActivity',
  '/tasks/getTaskComments',
  '/tasks/getTaskAttachments',
  '/tasks/getTaskAttachment',
  '/tasks/task-categories/list',
  '/tasks/task-categories/detail',
  '/getLeaveYears',
  '/getLeaveYearById',
  '/getHolidayCalendars',
  '/getHolidayCalendarById',
  '/getHolidaysByCalendar',
  '/getHolidayById',
  '/getLeaveTypes',
  '/getLeaveTypeById',
  '/getLeavePolicies',
  '/getLeavePolicyById',
  '/getLeavePolicyRules',
  '/getEmployeeLeaveConfiguration',
  '/getEmployeeLeaveBalances',
  '/getEmployeeBalanceForLeaveYear',
  '/getBalanceByLeaveType',
  '/getBalanceTransactionHistory',
  '/getLeaveRequests',
  '/getLeaveRequestDetails',
  '/getLeaveRequestApprovalHistory',
]);

const isAllowedReadOnlySupportRoute = (path: string): boolean => {
  if (READ_ONLY_SUPPORT_ROUTES.has(path)) {
    return true;
  }

  return /^\/ai-insights\/questions\/[^/]+$/.test(path);
};

export const requireSupportReadOnlyPolicy = (
  req: AuthRequest,
  res: Response,
  next: NextFunction
): void => {
  const supportContext = req.authContext;
  const adminPath = req.path.replace(/^\/api\/v1\/admin(?=\/|$)/, '').replace(/\/$/, '') || '/';
  if (
    !supportContext?.isSupportSession ||
    supportContext.accessMode !== 'SUPPORT_READ_ONLY' ||
    isAllowedReadOnlySupportRoute(adminPath)
  ) {
    next();
    return;
  }

  res.status(403).json({
    success: false,
    code: 'SUPPORT_READ_ONLY',
    message: 'This host is available in read-only support mode',
  });
};