import rateLimitConfig from '../config/rateLimit';

const rateLimiter = {
  public: rateLimitConfig.public,
  inquiry: rateLimitConfig.inquiry,
  auth: rateLimitConfig.auth,
  admin: rateLimitConfig.admin,
  app: rateLimitConfig.app,
};

export default rateLimiter;
