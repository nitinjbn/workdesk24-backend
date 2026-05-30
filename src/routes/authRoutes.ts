import { Router } from 'express';
import * as authController from '../controllers/authController';
import rateLimiter from '../middleware/rateLimiter';

const router = Router();

router.post('/register', rateLimiter.auth, authController.register);
router.post('/login', rateLimiter.auth, authController.login);

export default router;
