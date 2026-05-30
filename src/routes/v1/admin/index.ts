import { Router } from 'express';
import { authMiddleware } from '../../../shared/middleware/auth.middleware';
import userController from '../../../modules/admin/controllers/user.controller';
import inquiryController from '../../../modules/public/controllers/inquiry.controller';

const router = Router();

router.use(authMiddleware);

router.post('/users/list', userController.getAllUsers.bind(userController));
router.post('/users/get', userController.getUserById.bind(userController));
router.post('/users/update', userController.updateUser.bind(userController));
router.post('/users/delete', userController.deleteUser.bind(userController));

router.post('/inquiries/list', inquiryController.getAllInquiries.bind(inquiryController));
router.post('/inquiries/get', inquiryController.getInquiryById.bind(inquiryController));
router.post('/inquiries/update-status', inquiryController.updateInquiryStatus.bind(inquiryController));

router.post('/dashboard/stats', (req, res) => {
  res.json({
    success: true,
    message: 'Dashboard stats retrieved successfully',
    data: {
      totalUsers: 0,
      totalInquiries: 0,
      activeUsers: 0,
    },
  });
});

export default router;
