import { Router, Response, NextFunction } from 'express';
import { AuthRequest, PaginationParams } from '../../../types';
import { Inquiry, User } from '../../../models';

const router = Router();

// List inquiries
router.post('/list', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { page = 1, limit = 10, status, priority }: PaginationParams & {status?: string; priority?: string} = req.body;

    const offset = (page - 1) * limit;
    const where: any = {};

    if (status) where.status = status;
    if (priority) where.priority = priority;

    const { count, rows: inquiries } = await Inquiry.findAndCountAll({
      where,
      limit,
      offset,
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
      message: 'Inquiries retrieved successfully',
      data: {
        inquiries,
        pagination: {
          total: count,
          page,
          limit,
          pages: Math.ceil(count / limit),
        },
      },
    });
  } catch (error) {
    next(error);
  }
});

// Get inquiry by ID
router.post('/get', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inquiry ID is required',
      });
      return;
    }

    const inquiry = await Inquiry.findByPk(id, {
      include: [
        {
          model: User,
          as: 'assignedAdmin',
          attributes: ['id', 'name', 'email'],
        },
      ],
    });

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: 'Inquiry not found',
      });
      return;
    }

    res.json({
      success: true,
      message: 'Inquiry retrieved successfully',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
});

// Update inquiry
router.post('/update', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, priority, adminNotes } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inquiry ID is required',
      });
      return;
    }

    const inquiry = await Inquiry.findByPk(id);

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: 'Inquiry not found',
      });
      return;
    }

    await inquiry.update({ priority, adminNotes });

    res.json({
      success: true,
      message: 'Inquiry updated successfully',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
});

// Update inquiry status
router.post('/status', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, status } = req.body;

    if (!id || !status) {
      res.status(400).json({
        success: false,
        message: 'Inquiry ID and status are required',
      });
      return;
    }

    const inquiry = await Inquiry.findByPk(id);

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: 'Inquiry not found',
      });
      return;
    }

    await inquiry.update({ status });

    res.json({
      success: true,
      message: 'Inquiry status updated successfully',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
});

// Assign inquiry
router.post('/assign', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id, adminId } = req.body;

    if (!id || !adminId) {
      res.status(400).json({
        success: false,
        message: 'Inquiry ID and admin ID are required',
      });
      return;
    }

    const inquiry = await Inquiry.findByPk(id);

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: 'Inquiry not found',
      });
      return;
    }

    await inquiry.update({ assignedTo: adminId });

    res.json({
      success: true,
      message: 'Inquiry assigned successfully',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
});

// Delete inquiry
router.post('/delete', async (req: AuthRequest, res: Response, next: NextFunction) => {
  try {
    const { id } = req.body;

    if (!id) {
      res.status(400).json({
        success: false,
        message: 'Inquiry ID is required',
      });
      return;
    }

    const inquiry = await Inquiry.findByPk(id);

    if (!inquiry) {
      res.status(404).json({
        success: false,
        message: 'Inquiry not found',
      });
      return;
    }

    await inquiry.destroy();

    res.json({
      success: true,
      message: 'Inquiry deleted successfully',
    });
  } catch (error) {
    next(error);
  }
});

export default router;
