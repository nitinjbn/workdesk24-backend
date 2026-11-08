import rateLimit from 'express-rate-limit';
import { Request, Response } from 'express';

// Returns 429 responses in the same envelope as every other API error so the
// UI can rely on a consistent { success, code, statusCode, message } shape.
const createRateLimitHandler =
  (message: string) =>
  (_req: Request, res: Response): void => {
    res.status(429).json({
      success: false,
      code: 'TOO_MANY_REQUESTS',
      statusCode: 429,
      message,
    });
  };

const rateLimitConfig = {
  public: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    handler: createRateLimitHandler(
      'Too many requests from this IP, please try again later.'
    ),
    standardHeaders: true,
    legacyHeaders: false,
  }),

  inquiry: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 inquiries per hour
    handler: createRateLimitHandler('Too many inquiry submissions. Please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
  }),

  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per window
    handler: createRateLimitHandler(
      'Too many authentication attempts. Please try again later.'
    ),
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
  }),

  admin: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Higher limit for admin operations
    handler: createRateLimitHandler('Too many requests. Please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
  }),

  app: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300, // Moderate limit for authenticated app users
    handler: createRateLimitHandler('Too many requests. Please try again later.'),
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

export default rateLimitConfig;
