import 'dotenv/config';
import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import routes from './routes';
import healthRoutes from './routes/health.routes';
import { bullBoardBasePath, createBullBoardRouter } from './modules/bull-board';
import { errorHandler } from './shared/middleware/error-handler.middleware';
import responseSerializerMiddleware from './shared/middleware/response-serializer.middleware';
import { ApiLoggingErrorMiddleware, ApiLoggingMiddleware } from './modules/api-logs';
import { createCorsPolicy } from './shared/utils/cors-config.util';

const app: Application = express();

const corsPolicy = createCorsPolicy(
  process.env.NODE_ENV,
  process.env.CORS_ORIGINS,
  process.env.CORS_SUBDOMAIN_DOMAINS
);

// Middleware
app.use(
  cors({
    origin: corsPolicy.origin,
    credentials: corsPolicy.credentials,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Response serializer middleware - converts numeric fields from Sequelize
app.use(responseSerializerMiddleware);

// API logging middleware
app.use(ApiLoggingMiddleware);

// Trust proxy for correct IP addresses
app.set('trust proxy', true);


// Routes
app.use(bullBoardBasePath, createBullBoardRouter(bullBoardBasePath));
app.use('/background-jobs', createBullBoardRouter('/background-jobs'));
app.use('/api', healthRoutes);
app.use('/api', routes);

// 404 handler
app.use((_req: Request, res: Response) => {
  res.status(404).json({
    success: false,
    message: 'Route not found',
  });
});

// Error handler
app.use(ApiLoggingErrorMiddleware);
app.use(errorHandler);

export default app;
