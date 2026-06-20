import { Router } from 'express';
import rateLimitConfig from '../../../config/rateLimit';
import { authMiddleware, requireAdminRole } from '../../../shared/middleware/auth.middleware';
import { requireAdminCsrfToken } from '../../../shared/middleware/csrf.middleware';
import adminAuthController from '../../../modules/admin/controllers/auth.controller';
import userController from '../../../modules/admin/controllers/user.controller';
import inquiryController from '../../../modules/public/controllers/inquiry.controller';
import reportController from '../../../modules/reporting/controllers/report.controller';
import { User, Inquiry } from '../../../models/index';

const router = Router();

router.post('/login', rateLimitConfig.auth, adminAuthController.login.bind(adminAuthController));
router.post('/refresh', rateLimitConfig.auth, requireAdminCsrfToken, adminAuthController.refresh.bind(adminAuthController));
router.post('/logout', requireAdminCsrfToken, adminAuthController.logout.bind(adminAuthController));

router.use(authMiddleware);
router.use(requireAdminRole);
router.use(requireAdminCsrfToken);

router.post('/users/list', userController.getAllUsers.bind(userController));
router.post('/users/get', userController.getUserById.bind(userController));
router.post('/users/update', userController.updateUser.bind(userController));
router.post('/users/delete', userController.deleteUser.bind(userController));

router.post('/inquiries/list', inquiryController.getAllInquiries.bind(inquiryController));
router.post('/inquiries/get', inquiryController.getInquiryById.bind(inquiryController));
router.post('/inquiries/update', inquiryController.updateInquiry.bind(inquiryController));
router.post('/inquiries/status', inquiryController.updateInquiryStatus.bind(inquiryController));
router.post('/inquiries/assign', inquiryController.assignInquiry.bind(inquiryController));
router.post('/inquiries/delete', inquiryController.deleteInquiry.bind(inquiryController));

router.post('/reports/getGPSHistory', reportController.getAdminGpsHistory.bind(reportController));
router.post('/reports/getAttendance', reportController.getAdminAttendance.bind(reportController));


router.post('/dashboard/stats', async (req, res, next) => {
  try {
    const [totalUsers, totalInquiries, pendingInquiries, resolvedInquiries] = await Promise.all([
      User.count(),
      Inquiry.count(),
      Inquiry.count({ where: { status: 'pending' } }),
      Inquiry.count({ where: { status: 'resolved' } }),
    ]);

    res.json({
      success: true,
      message: 'Dashboard statistics retrieved successfully',
      data: {
        totalUsers,
        totalInquiries,
        pendingInquiries,
        resolvedInquiries,
        inProgressInquiries: totalInquiries - pendingInquiries - resolvedInquiries,
      },
    });
  } catch (error) {
    next(error);
  }
});

router.post('/dashboard/recent-inquiries', async (req, res, next) => {
  try {
    const { limit = 5 } = req.body;

    const inquiries = await Inquiry.findAll({
      limit: parseInt(String(limit)),
      order: [['createdAt', 'DESC']],
      include: [
        {
          model: User,
          as: 'assignedAdmin',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    res.json({
      success: true,
      message: 'Recent inquiries retrieved successfully',
      data: inquiries,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
