import express, { Application, Request, Response } from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import dotenv from 'dotenv';
import routes from './routes';
import healthRoutes from './routes/health.routes';
import { errorHandler } from './shared/middleware/error-handler.middleware';

dotenv.config();

const app: Application = express();

const getCorsOrigins = (): string[] => {
  const configuredOrigins = process.env.CORS_ORIGINS?.trim();
  if (!configuredOrigins) {
    return [];
  }

  return configuredOrigins
    .split(',')
    .map((origin) => origin.trim())
    .filter((origin) => origin.length > 0);
};

const allowedOrigins = getCorsOrigins();

// Middleware
app.use(
  cors({
    origin: (origin, callback) => {
      if (!origin || !allowedOrigins.length || allowedOrigins.includes(origin)) {
        callback(null, true);
        return;
      }

      callback(new Error('Origin is not allowed by CORS policy'));
    },
    credentials: true,
  })
);
app.use(cookieParser());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Trust proxy for correct IP addresses
app.set('trust proxy', true);

// Routes
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
app.use(errorHandler);

export default app;
