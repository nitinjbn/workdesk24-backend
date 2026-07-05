import { Router } from 'express';
import authController from '../../../modules/auth/controllers/auth.controller';

const router = Router();

router.post('/register', authController.register.bind(authController)); //To be deprecated
router.post('/login', authController.login.bind(authController));

export default router;
