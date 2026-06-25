import app from './app';
import { initializeDatabase, getDatabaseStatus } from './models/index';
import { logger } from './config/database';

const PORT = process.env.PORT || 3000;
const NODE_ENV = process.env.NODE_ENV || 'development';
const DB_RETRY_DELAY_MS = parseInt(process.env.DB_RETRY_DELAY_MS || '30000', 10);

/**
 * Production-Grade Server Startup
 * CMM Level 5: Optimizing
 *
 * Features:
 * - Proper initialization sequence
 * - Database health checks
 * - Graceful error handling
 * - Performance monitoring
 * - Health check endpoints
 */

async function startServer() {
  try {
    logger.info('Starting server...', {
      env: NODE_ENV,
      port: PORT,
      nodeVersion: process.version,
    });

    const initializeDatabaseInBackground = async (): Promise<void> => {
      try {
        logger.info('Initializing database connection...');
        await initializeDatabase();

        const dbStatus = getDatabaseStatus();
        if (!dbStatus.isHealthy) {
          throw new Error('Database health check failed');
        }

        logger.info('Database connection healthy', {
          metrics: dbStatus.metrics,
        });
      } catch (error: any) {
        logger.error('Database initialization failed; continuing in degraded mode', {
          error: error.message,
          stack: error.stack,
          retryInMs: DB_RETRY_DELAY_MS,
        });

        setTimeout(() => {
          void initializeDatabaseInBackground();
        }, DB_RETRY_DELAY_MS);
      }
    };

    const server = app.listen(PORT, () => {
      logger.info('Server started successfully', {
        port: PORT,
        env: NODE_ENV,
        timestamp: new Date().toISOString(),
      });

      void initializeDatabaseInBackground();
    });

    // Setup server error handlers
    server.on('error', (error: any) => {
      if (error.code === 'EADDRINUSE') {
        logger.error(`Port ${PORT} is already in use`);
      } else {
        logger.error('Server error', {
          error: error.message,
          stack: error.stack,
        });
      }
      process.exit(1);
    });

    // Graceful shutdown handler
    const shutdown = async (signal: string) => {
      logger.info(`Received ${signal} - shutting down gracefully`);

      // Stop accepting new connections
      server.close(async () => {
        logger.info('HTTP server closed');

        try {
          // Database connection manager handles its own graceful shutdown
          // via process signal handlers
          logger.info('Shutdown complete');
          process.exit(0);
        } catch (error: any) {
          logger.error('Error during shutdown', {
            error: error.message,
            stack: error.stack,
          });
          process.exit(1);
        }
      });

      // Force shutdown after timeout
      setTimeout(() => {
        logger.error('Forced shutdown due to timeout');
        process.exit(1);
      }, 30000); // 30 seconds
    };

    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

  } catch (error: any) {
    logger.error('Failed to start server', {
      error: error.message,
      stack: error.stack,
    });
    process.exit(1);
  }
}

// Handle uncaught errors
process.on('uncaughtException', (error: Error) => {
  logger.error('Uncaught exception', {
    error: error.message,
    stack: error.stack,
  });
  process.exit(1);
});

process.on('unhandledRejection', (reason: any) => {
  logger.error('Unhandled promise rejection', {
    reason: reason?.message || reason,
    stack: reason?.stack,
  });
  process.exit(1);
});

// Start the server
startServer();
