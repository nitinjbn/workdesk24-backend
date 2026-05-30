import rateLimit from 'express-rate-limit';

const rateLimitConfig = {
  public: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 100, // 100 requests per window
    message: 'Too many requests from this IP, please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  inquiry: rateLimit({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 5, // 5 inquiries per hour
    message: 'Too many inquiry submissions. Please try again later.',
    standardHeaders: true,
    legacyHeaders: false,
  }),

  auth: rateLimit({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 10, // 10 login attempts per window
    message: 'Too many authentication attempts. Please try again later.',
    skipSuccessfulRequests: true,
    standardHeaders: true,
    legacyHeaders: false,
  }),

  admin: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 500, // Higher limit for admin operations
    standardHeaders: true,
    legacyHeaders: false,
  }),

  app: rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300, // Moderate limit for authenticated app users
    standardHeaders: true,
    legacyHeaders: false,
  }),
};

export default rateLimitConfig;
