import { Router } from "express";
import { aiController } from "../../../modules/ai/AIController";

const router = Router();

router.post("/chat", aiController.chat.bind(aiController));

export default router;