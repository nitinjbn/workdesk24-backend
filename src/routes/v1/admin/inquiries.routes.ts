import { Router } from 'express';
import inquiryController from '../../../modules/public/controllers/inquiry.controller';

const router = Router();

router.post('/inquiries/list', inquiryController.getAllInquiries.bind(inquiryController));
router.post('/inquiries/get', inquiryController.getInquiryById.bind(inquiryController));
router.post('/inquiries/update', inquiryController.updateInquiry.bind(inquiryController));
router.post('/inquiries/status', inquiryController.updateInquiryStatus.bind(inquiryController));
router.post('/inquiries/assign', inquiryController.assignInquiry.bind(inquiryController));
router.post('/inquiries/delete', inquiryController.deleteInquiry.bind(inquiryController));

export default router;
