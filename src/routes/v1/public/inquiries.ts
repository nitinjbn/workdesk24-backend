import { Router, Request, Response, NextFunction } from 'express';
import { Inquiry } from '../../../models';
import EmailService from '../../../services/emailService';
import rateLimiter from '../../../middleware/rateLimiter';

const router = Router();

router.post('/', rateLimiter.inquiry, async (req: Request, res: Response, next: NextFunction) => {
  try {
    const { name, email, phone, subject, message } = req.body;

    if (!name || !email || !subject || !message) {
      res.status(400).json({
        success: false,
        message: 'Name, email, subject, and message are required',
      });
      return;
    }

    const inquiry = await Inquiry.create({
      name,
      email,
      phone,
      subject,
      message,
      ipAddress: req.ip,
      userAgent: req.get('user-agent'),
      status: 'pending',
      priority: 'medium',
    });

    // Send email notifications
    await Promise.all([
      EmailService.sendInquiryNotification(inquiry),
      EmailService.sendInquiryConfirmation(inquiry),
    ]);

    res.status(201).json({
      success: true,
      message: 'Inquiry submitted successfully',
      data: inquiry,
    });
  } catch (error) {
    next(error);
  }
});

export default router;
