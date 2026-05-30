import { Router, Response, NextFunction } from 'express';
import { AuthRequest } from '../../../types';
import { User, Inquiry } from '../../../models';

const router = Router();

// Get dashboard statistics
router.post('/stats', async (_req: AuthRequest, res: Response, next: NextFunction) => {
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

// Get recent inquiries
router.post('/recent-inquiries', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { limit = 5 } = req.body;

    const inquiries = await Inquiry.findAll({
      limit,
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
