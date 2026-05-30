import { Router, Request, Response } from 'express';

const router = Router();

router.post('/health', (req: Request, res: Response) => {
  res.json({
    success: true,
    message: 'API is running',
    timestamp: new Date().toISOString(),
  });
});

router.post('/version', (req: Request, res: Response) => {
  res.json({
    success: true,
    version: '1.0.0',
    api: 'v1',
  });
});

export default router;
