import { Router } from 'express';
import inquiryController from '../../../modules/public/controllers/inquiry.controller';
import { apiLogRouteContext } from '../../../modules/api-logs';

const router = Router();
router.use('/inquiries', apiLogRouteContext('public', 'inquiries'));
router.use('/info', apiLogRouteContext('public', 'info'));

// Inquiry endpoints - RESTful standard
router.post('/inquiries', inquiryController.createInquiry.bind(inquiryController));

// Info endpoints
router.post('/info/health', (req, res) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

router.post('/info/version', (req, res) => {
  res.json({
    success: true,
    version: '1.0.0',
    api: 'v1',
  });
});

export default router;
