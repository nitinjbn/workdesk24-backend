import { Router } from 'express';
import multer from 'multer';
import customerController from '../../../modules/master/controllers/customer.controller';

const router = Router();
const upload = multer({ storage: multer.memoryStorage() });

router.post('/customers/getCustomerTypes', customerController.getCustomerTypes.bind(customerController));
router.post('/customers/getCustomers', customerController.getCustomers.bind(customerController));
router.post('/customers/getCustomerDetails', customerController.getCustomerDetails.bind(customerController));
router.post('/customers/uploadMedia', upload.single('media'), customerController.uploadMedia.bind(customerController));
router.post('/customers/deleteMedia', customerController.deleteMedia.bind(customerController));
router.post('/customers/createCustomer', customerController.createCustomer.bind(customerController));
router.post('/customers/updateCustomer', customerController.updateCustomer.bind(customerController));
router.post('/customers/deleteCustomer', customerController.deleteCustomer.bind(customerController));

export default router;
