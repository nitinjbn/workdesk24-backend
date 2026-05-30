import { Router } from 'express';
import inquiryController from '../../../modules/public/controllers/inquiry.controller';

const router = Router();

router.post('/inquiry/create', inquiryController.createInquiry.bind(inquiryController));

router.post('/info/get', (req, res) => {
  res.json({
    success: true,
    message: 'Public info retrieved successfully',
    data: {
      appName: 'WorkDesk24',
      version: '1.0.0',
      contactEmail: 'support@workdesk24.com',
    },
  });
});

export default router;
