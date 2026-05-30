import { Router } from 'express';
import v1Routes from './v1';

const router = Router();

// All versioned routes under /v1
router.use('/v1', v1Routes);

// Health check (no version - utility endpoint)
router.get('/health', (req, res) => {
  res.json({
    success: true,
    message: 'Server is running',
    data: {
      timestamp: Math.floor(Date.now() / 1000),
      version: '1.0.0',
    },
  });
});

export default router;
