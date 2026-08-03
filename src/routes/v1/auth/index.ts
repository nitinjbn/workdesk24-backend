import { Router } from 'express';
import authController from '../../../modules/auth/controllers/auth.controller';
import { apiLogRouteContext } from '../../../modules/api-logs';
//import authNotificationController from '../../../modules/notifications/auth/controllers/auth-notification.controller';

const router = Router();
router.use(apiLogRouteContext('auth', 'auth'));

router.post('/requestOtp', authController.requestOtp.bind(authController));
router.post('/verifyOtp', authController.verifyOtp.bind(authController));
router.post('/refresh', authController.refresh.bind(authController));
//router.post('/register', authController.register.bind(authController)); //To be deprecated
router.post('/login', authController.login.bind(authController)); //To be deprecated

export default router;
