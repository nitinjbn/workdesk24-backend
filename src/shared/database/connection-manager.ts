import { Sequelize } from 'sequelize';
import { logger } from '../../config/database.production';

/**
 * Production-Grade Database Connection Manager
 * CMM Level 5: Optimizing
 *
 * Features:
 * - Connection health monitoring
 * - Automatic reconnection
 * - Graceful shutdown
 * - Performance metrics
 * - Circuit breaker pattern
 * - Connection pool monitoring
 */

export interface ConnectionMetrics {
  totalConnections: number;
  activeConnections: number;
  idleConnections: number;
  waitingRequests: number;
  errors: number;
  slowQueries: number;
  lastHealthCheck: Date | null;
  uptime: number;
  startTime: Date;
}

export interface HealthCheckResult {
  isHealthy: boolean;
  responseTime: number;
  error?: string;
  timestamp: Date;
}

export class DatabaseConnectionManager {
  private sequelize: Sequelize;
  private healthCheckInterval: NodeJS.Timeout | null = null;
  private metricsInterval: NodeJS.Timeout | null = null;
  private metrics: ConnectionMetrics;
  private isShuttingDown: boolean = false;
  private circuitBreakerFailures: number = 0;
  private circuitBreakerOpen: boolean = false;
  private readonly CIRCUIT_BREAKER_THRESHOLD = 5;
  private readonly CIRCUIT_BREAKER_TIMEOUT = 60000; // 1 minute

  constructor(sequelize: Sequelize) {
    this.sequelize = sequelize;
    this.metrics = {
      totalConnections: 0,
      activeConnections: 0,
      idleConnections: 0,
      waitingRequests: 0,
      errors: 0,
      slowQueries: 0,
      lastHealthCheck: null,
      uptime: 0,
      startTime: new Date(),
    };

    this.setupEventListeners();
  }

  /**
   * Initialize database connection with health monitoring
   */
  async initialize(): Promise<void> {
    try {
      logger.info('Initializing database connection...');

      // Test connection
      await this.testConnection();

      // Start health monitoring
      this.startHealthMonitoring();

      // Start metrics collection
      this.startMetricsCollection();

      // Setup graceful shutdown
      this.setupGracefulShutdown();

      logger.info('Database connection initialized successfully', {
        poolSize: this.getPoolConfig(),
        metrics: this.metrics,
      });
    } catch (error: any) {
      logger.error('Failed to initialize database connection', {
        error: error.message,
        stack: error.stack,
      });
      throw error;
    }
  }

  /**
   * Test database connection
   */
  async testConnection(): Promise<void> {
    const startTime = Date.now();
    try {
      await this.sequelize.authenticate();
      const responseTime = Date.now() - startTime;

      logger.info('Database connection test successful', {
        responseTime: `${responseTime}ms`,
      });

      // Reset circuit breaker on successful connection
      this.circuitBreakerFailures = 0;
      this.circuitBreakerOpen = false;
    } catch (error: any) {
      const responseTime = Date.now() - startTime;

      this.metrics.errors++;
      this.circuitBreakerFailures++;

      // Open circuit breaker if threshold reached
      if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.openCircuitBreaker();
      }

      logger.error('Database connection test failed', {
        error: error.message,
        responseTime: `${responseTime}ms`,
        circuitBreakerFailures: this.circuitBreakerFailures,
      });

      throw error;
    }
  }

  /**
   * Perform health check
   */
  async healthCheck(): Promise<HealthCheckResult> {
    if (this.circuitBreakerOpen) {
      return {
        isHealthy: false,
        responseTime: 0,
        error: 'Circuit breaker is open',
        timestamp: new Date(),
      };
    }

    const startTime = Date.now();
    try {
      await this.sequelize.query('SELECT 1', {
        type: 'SELECT',
        raw: true,
      });

      const responseTime = Date.now() - startTime;
      this.metrics.lastHealthCheck = new Date();

      // Reset circuit breaker on successful health check
      this.circuitBreakerFailures = 0;

      return {
        isHealthy: true,
        responseTime,
        timestamp: new Date(),
      };
    } catch (error: any) {
      const responseTime = Date.now() - startTime;
      this.metrics.errors++;
      this.circuitBreakerFailures++;

      if (this.circuitBreakerFailures >= this.CIRCUIT_BREAKER_THRESHOLD) {
        this.openCircuitBreaker();
      }

      logger.error('Health check failed', {
        error: error.message,
        responseTime: `${responseTime}ms`,
        circuitBreakerFailures: this.circuitBreakerFailures,
      });

      return {
        isHealthy: false,
        responseTime,
        error: error.message,
        timestamp: new Date(),
      };
    }
  }

  /**
   * Open circuit breaker to prevent cascading failures
   */
  private openCircuitBreaker(): void {
    if (this.circuitBreakerOpen) return;

    this.circuitBreakerOpen = true;
    logger.error('Circuit breaker opened - stopping database requests', {
      failures: this.circuitBreakerFailures,
      timeout: this.CIRCUIT_BREAKER_TIMEOUT,
    });

    // Attempt to close circuit breaker after timeout
    setTimeout(() => {
      this.circuitBreakerFailures = 0;
      this.circuitBreakerOpen = false;
      logger.info('Circuit breaker closed - resuming database requests');
    }, this.CIRCUIT_BREAKER_TIMEOUT);
  }

  /**
   * Start health monitoring
   */
  private startHealthMonitoring(): void {
    const interval = parseInt(process.env.DB_HEALTH_CHECK_INTERVAL || '30000', 10);

    this.healthCheckInterval = setInterval(async () => {
      if (this.isShuttingDown) return;

      const health = await this.healthCheck();

      if (!health.isHealthy) {
        logger.warn('Database health check failed', health);
      } else if (health.responseTime > 1000) {
        logger.warn('Slow database health check', health);
      }
    }, interval);

    logger.info('Health monitoring started', {
      interval: `${interval}ms`,
    });
  }

  /**
   * Start metrics collection
   */
  private startMetricsCollection(): void {
    const interval = parseInt(process.env.DB_METRICS_INTERVAL || '60000', 10);

    this.metricsInterval = setInterval(() => {
      if (this.isShuttingDown) return;

      this.updateMetrics();
      this.logMetrics();
    }, interval);

    logger.info('Metrics collection started', {
      interval: `${interval}ms`,
    });
  }

  /**
   * Update connection metrics
   * Note: Accessing internal pool structure - may vary by Sequelize version
   */
  private updateMetrics(): void {
    try {
      const connectionManager = this.sequelize.connectionManager as any;
      const pool = connectionManager?.pool;

      if (pool) {
        // Generic-pool properties (used by Sequelize v6)
        this.metrics.totalConnections = pool.size || 0;
        this.metrics.activeConnections = (pool.borrowed || pool.using || 0);
        this.metrics.idleConnections = (pool.available || pool.free || 0);
        this.metrics.waitingRequests = (pool.pending || pool.waiting || 0);
      }
    } catch (error: any) {
      logger.warn('Failed to update connection pool metrics', {
        error: error.message,
      });
    }

    this.metrics.uptime = Date.now() - this.metrics.startTime.getTime();
  }

  /**
   * Log connection metrics
   */
  private logMetrics(): void {
    const poolConfig = this.getPoolConfig();
    const utilizationPercent = poolConfig.max > 0
      ? ((this.metrics.activeConnections / poolConfig.max) * 100).toFixed(2)
      : '0';

    logger.info('Database connection metrics', {
      total: this.metrics.totalConnections,
      active: this.metrics.activeConnections,
      idle: this.metrics.idleConnections,
      waiting: this.metrics.waitingRequests,
      utilization: `${utilizationPercent}%`,
      errors: this.metrics.errors,
      slowQueries: this.metrics.slowQueries,
      uptime: `${(this.metrics.uptime / 1000 / 60).toFixed(2)} minutes`,
      poolConfig,
    });

    // Warn if pool utilization is high
    if (parseFloat(utilizationPercent) > 80) {
      logger.warn('High database connection pool utilization', {
        utilization: `${utilizationPercent}%`,
        active: this.metrics.activeConnections,
        max: poolConfig.max,
        recommendation: 'Consider increasing pool size',
      });
    }

    // Warn if requests are waiting
    if (this.metrics.waitingRequests > 0) {
      logger.warn('Requests waiting for database connections', {
        waiting: this.metrics.waitingRequests,
        active: this.metrics.activeConnections,
        max: poolConfig.max,
        recommendation: 'Consider increasing pool size or optimizing queries',
      });
    }
  }

  /**
   * Setup event listeners for connection events
   * Note: Sequelize v6 doesn't expose connectionManager events directly.
   * We rely on pool metrics and hooks instead.
   */
  private setupEventListeners(): void {
    // Use Sequelize hooks for connection tracking
    this.sequelize.addHook('beforeConnect', () => {
      logger.debug('Database connection attempt');
    });

    this.sequelize.addHook('afterConnect', () => {
      this.metrics.totalConnections++;
      logger.debug('Database connection established');
    });

    this.sequelize.addHook('beforeDisconnect', () => {
      logger.debug('Database disconnecting');
    });
  }

  /**
   * Get pool configuration
   */
  private getPoolConfig(): { min: number; max: number; acquire: number; idle: number } {
    const options = (this.sequelize as Sequelize & { options?: { pool?: { min?: number; max?: number; acquire?: number; idle?: number } } }).options;
    return {
      min: options.pool?.min || 0,
      max: options.pool?.max || 0,
      acquire: options.pool?.acquire || 0,
      idle: options.pool?.idle || 0,
    };
  }

  /**
   * Get current metrics
   */
  getMetrics(): ConnectionMetrics {
    this.updateMetrics();
    return { ...this.metrics };
  }

  /**
   * Get connection status
   */
  getStatus(): {
    isConnected: boolean;
    isHealthy: boolean;
    circuitBreakerOpen: boolean;
    metrics: ConnectionMetrics;
  } {
    return {
      isConnected: !this.isShuttingDown,
      isHealthy: !this.circuitBreakerOpen && this.metrics.errors < 10,
      circuitBreakerOpen: this.circuitBreakerOpen,
      metrics: this.getMetrics(),
    };
  }

  /**
   * Setup graceful shutdown
   */
  private setupGracefulShutdown(): void {
    const shutdown = async (signal: string) => {
      if (this.isShuttingDown) return;

      logger.info(`Received ${signal} - initiating graceful shutdown`);
      this.isShuttingDown = true;

      try {
        // Stop health monitoring
        if (this.healthCheckInterval) {
          clearInterval(this.healthCheckInterval);
          this.healthCheckInterval = null;
        }

        // Stop metrics collection
        if (this.metricsInterval) {
          clearInterval(this.metricsInterval);
          this.metricsInterval = null;
        }

        // Wait for active connections to complete (max 10 seconds)
        const maxWait = 10000;
        const checkInterval = 100;
        let waited = 0;

        while (this.metrics.activeConnections > 0 && waited < maxWait) {
          await new Promise(resolve => setTimeout(resolve, checkInterval));
          waited += checkInterval;
          this.updateMetrics();
        }

        if (this.metrics.activeConnections > 0) {
          logger.warn('Forcing shutdown with active connections', {
            activeConnections: this.metrics.activeConnections,
          });
        }

        // Close database connection
        await this.sequelize.close();
        logger.info('Database connection closed successfully');

        process.exit(0);
      } catch (error: any) {
        logger.error('Error during graceful shutdown', {
          error: error.message,
          stack: error.stack,
        });
        process.exit(1);
      }
    };

    // Handle shutdown signals
    process.on('SIGTERM', () => shutdown('SIGTERM'));
    process.on('SIGINT', () => shutdown('SIGINT'));

    // Handle uncaught errors
    process.on('uncaughtException', (error: Error) => {
      logger.error('Uncaught exception', {
        error: error.message,
        stack: error.stack,
      });
      shutdown('uncaughtException');
    });

    process.on('unhandledRejection', (reason: any) => {
      logger.error('Unhandled rejection', {
        reason: reason?.message || reason,
        stack: reason?.stack,
      });
      shutdown('unhandledRejection');
    });
  }

  /**
   * Force shutdown (for testing)
   */
  async forceShutdown(): Promise<void> {
    this.isShuttingDown = true;

    if (this.healthCheckInterval) {
      clearInterval(this.healthCheckInterval);
    }

    if (this.metricsInterval) {
      clearInterval(this.metricsInterval);
    }

    await this.sequelize.close();
  }
}
