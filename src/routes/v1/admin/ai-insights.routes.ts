import { Router } from "express";
import { aiInsightsController } from '../../../modules/ai-insights';

const router = Router();

router.post('/ai-insights/categories', aiInsightsController.getCategories);
router.post('/ai-insights/questions/:insightId', aiInsightsController.getQuestion);
router.post('/ai-insights/query', aiInsightsController.executeInsight);

export default router;