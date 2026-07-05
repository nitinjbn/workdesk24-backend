import { Router } from 'express';
import { Inquiry, User } from '../../../models/index';

const router = Router();

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
