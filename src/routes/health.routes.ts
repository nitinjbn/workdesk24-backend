import { Router, Request, Response } from 'express';
import { getDatabaseStatus, getDatabaseMetrics, performHealthCheck } from '../models/index.production';

const router = Router();

/**
 * Basic health check endpoint
 * Returns 200 if server is running
 */
router.get('/health', (req: Request, res: Response) => {
  res.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  });
});

/**
 * Detailed health check endpoint
 * Includes database connection status
 */
router.get('/health/detailed', async (req: Request, res: Response) => {
  try {
    const dbStatus = getDatabaseStatus();
    const healthCheck = await performHealthCheck();

    const status = dbStatus.isHealthy && healthCheck.isHealthy ? 'healthy' : 'unhealthy';
    const statusCode = status === 'healthy' ? 200 : 503;

    res.status(statusCode).json({
      status,
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      environment: process.env.NODE_ENV || 'development',
      database: {
        isConnected: dbStatus.isConnected,
        isHealthy: dbStatus.isHealthy,
        circuitBreakerOpen: dbStatus.circuitBreakerOpen,
        responseTime: healthCheck.responseTime,
        lastCheck: healthCheck.timestamp,
      },
      memory: {
        used: `${(process.memoryUsage().heapUsed / 1024 / 1024).toFixed(2)} MB`,
        total: `${(process.memoryUsage().heapTotal / 1024 / 1024).toFixed(2)} MB`,
        rss: `${(process.memoryUsage().rss / 1024 / 1024).toFixed(2)} MB`,
      },
      cpu: {
        usage: process.cpuUsage(),
      },
    });
  } catch (error: any) {
    res.status(503).json({
      status: 'unhealthy',
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Readiness probe endpoint
 * Returns 200 when server is ready to accept traffic
 * Used by Kubernetes/load balancers
 */
router.get('/health/ready', async (req: Request, res: Response) => {
  try {
    const dbStatus = getDatabaseStatus();

    if (dbStatus.isHealthy && !dbStatus.circuitBreakerOpen) {
      res.status(200).json({
        ready: true,
        timestamp: new Date().toISOString(),
      });
    } else {
      res.status(503).json({
        ready: false,
        timestamp: new Date().toISOString(),
        reason: dbStatus.circuitBreakerOpen ? 'Circuit breaker open' : 'Database unhealthy',
      });
    }
  } catch (error: any) {
    res.status(503).json({
      ready: false,
      timestamp: new Date().toISOString(),
      error: error.message,
    });
  }
});

/**
 * Liveness probe endpoint
 * Returns 200 if server process is alive
 * Used by Kubernetes/load balancers
 */
router.get('/health/live', (req: Request, res: Response) => {
  res.status(200).json({
    alive: true,
    timestamp: new Date().toISOString(),
  });
});

/**
 * Database metrics endpoint (admin only)
 * Returns detailed connection pool metrics
 */
router.get('/health/metrics', async (req: Request, res: Response) => {
  // TODO: Add authentication middleware for production
  try {
    const metrics = getDatabaseMetrics();
    const dbStatus = getDatabaseStatus();

    res.json({
      timestamp: new Date().toISOString(),
      database: {
        status: dbStatus.isHealthy ? 'healthy' : 'unhealthy',
        circuitBreakerOpen: dbStatus.circuitBreakerOpen,
        connections: {
          total: metrics.totalConnections,
          active: metrics.activeConnections,
          idle: metrics.idleConnections,
          waiting: metrics.waitingRequests,
        },
        performance: {
          errors: metrics.errors,
          slowQueries: metrics.slowQueries,
          lastHealthCheck: metrics.lastHealthCheck,
          uptime: `${(metrics.uptime / 1000 / 60).toFixed(2)} minutes`,
        },
      },
      server: {
        memory: process.memoryUsage(),
        cpu: process.cpuUsage(),
        uptime: process.uptime(),
      },
    });
  } catch (error: any) {
    res.status(500).json({
      error: error.message,
    });
  }
});

export default router;
