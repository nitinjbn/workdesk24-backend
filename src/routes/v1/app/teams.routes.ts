import { Router } from 'express';
import eligibilityController from '../../../modules/auth/controllers/assignment-eligibility.controller';

const router = Router();

router.post('/getEligibleUsers', eligibilityController.getEligibleUsers.bind(eligibilityController));

export default router;
