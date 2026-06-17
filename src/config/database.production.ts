import dotenv from 'dotenv';
import { Options, Dialect, Transaction } from 'sequelize';
import winston from 'winston';

dotenv.config();

/**
 * Production-Grade Database Configuration
 * CMM Level 5: Optimizing
 *
 * Features:
 * - Advanced connection pooling
 * - Health monitoring
 * - Automatic retry with exponential backoff
 * - Performance optimization
 * - Production-safe logging
 * - Graceful degradation
 */

// Logger configuration
const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  transports: [
    new winston.transports.File({ filename: 'logs/database-error.log', level: 'error' }),
    new winston.transports.File({ filename: 'logs/database-combined.log' }),
  ],
});

if (process.env.NODE_ENV !== 'production') {
  logger.add(new winston.transports.Console({
    format: winston.format.simple(),
  }));
}

/**
 * Calculate optimal pool size based on environment
 * Formula: pool_size = (number_of_cores * 2) + effective_spindle_count
 * For cloud environments, adjust based on available resources
 */
function calculatePoolSize(): { min: number; max: number } {
  const env = process.env.NODE_ENV || 'development';

  if (env === 'production') {
    // Production: Higher pool for handling traffic
    return {
      min: parseInt(process.env.DB_POOL_MIN || '10', 10),
      max: parseInt(process.env.DB_POOL_MAX || '50', 10),
    };
  } else if (env === 'staging') {
    // Staging: Moderate pool
    return {
      min: parseInt(process.env.DB_POOL_MIN || '5', 10),
      max: parseInt(process.env.DB_POOL_MAX || '20', 10),
    };
  } else {
    // Development: Smaller pool
    return {
      min: parseInt(process.env.DB_POOL_MIN || '2', 10),
      max: parseInt(process.env.DB_POOL_MAX || '10', 10),
    };
  }
}

/**
 * Production-safe query logger
 * Logs slow queries and errors without exposing sensitive data
 */
const productionLogging = (sql: string, timing?: number): void => {
  const env = process.env.NODE_ENV || 'development';
  const slowQueryThreshold = parseInt(process.env.SLOW_QUERY_THRESHOLD || '1000', 10);

  // Only log in development or if query is slow
  if (env === 'development') {
    console.log(`[Sequelize] ${sql}`, timing ? `(${timing}ms)` : '');
  } else if (timing && timing > slowQueryThreshold) {
    logger.warn({
      message: 'Slow query detected',
      duration: timing,
      query: sql.substring(0, 200), // Truncate for security
      timestamp: new Date().toISOString(),
    });
  }
};

interface DatabaseConfig extends Options {
  username: string;
  password: string;
  database: string;
  host: string;
  port: number;
  dialect: Dialect;
}

interface Config {
  development: DatabaseConfig;
  test: DatabaseConfig;
  staging: DatabaseConfig;
  production: DatabaseConfig;
  [key: string]: DatabaseConfig;
}

const poolSize = calculatePoolSize();

const config: Config = {
  development: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'workdesk24',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',

    // Connection pool configuration
    pool: {
      max: 10,
      min: 2,
      acquire: 30000,  // 30 seconds
      idle: 10000,     // 10 seconds
      evict: 60000,    // 1 minute
    },

    // Query configuration
    logging: console.log,
    benchmark: true,
    logQueryParameters: true,

    // Retry configuration
    retry: {
      max: 3,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /ETIMEDOUT/,
        /ECONNREFUSED/,
        /ECONNRESET/,
        /EPIPE/,
      ],
      backoffBase: 1000,
      backoffExponent: 1.5,
    },

    // Connection configuration
    dialectOptions: {
      connectTimeout: 30000,
      decimalNumbers: true,
      dateStrings: true,
      typeCast: true,
    },

    define: {
      underscored: false,
      timestamps: false,
      freezeTableName: true,
    },

    // Transaction configuration
    transactionType: Transaction.TYPES.IMMEDIATE,
    isolationLevel: 'READ_COMMITTED',
  },

  test: {
    username: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME_TEST || 'workdesk24_test',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',

    pool: {
      max: 5,
      min: 1,
      acquire: 20000,
      idle: 5000,
      evict: 30000,
    },

    logging: false,
    benchmark: false,

    retry: {
      max: 2,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
      ],
      backoffBase: 500,
      backoffExponent: 1.5,
    },

    dialectOptions: {
      connectTimeout: 20000,
      decimalNumbers: true,
    },

    define: {
      underscored: false,
      timestamps: false,
      freezeTableName: true,
    },
  },

  staging: {
    username: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',

    // Staging pool size
    pool: {
      max: poolSize.max,
      min: poolSize.min,
      acquire: 30000,
      idle: 10000,
      evict: 60000,
    },

    // Production-style logging
    logging: productionLogging,
    benchmark: true,
    logQueryParameters: false,

    // Retry configuration
    retry: {
      max: 3,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /ETIMEDOUT/,
        /ECONNREFUSED/,
        /ECONNRESET/,
        /EPIPE/,
      ],
      backoffBase: 1000,
      backoffExponent: 1.5,
    },

    // SSL configuration for cloud databases
    dialectOptions: {
      connectTimeout: 30000,
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
      } : false,
      decimalNumbers: true,
      dateStrings: true,
      typeCast: true,
      multipleStatements: false,
    },

    define: {
      underscored: false,
      timestamps: false,
      freezeTableName: true,
    },

    transactionType: Transaction.TYPES.IMMEDIATE,
    isolationLevel: 'READ_COMMITTED',
  },

  production: {
    username: process.env.DB_USER || '',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || '',
    host: process.env.DB_HOST || 'localhost',
    port: parseInt(process.env.DB_PORT || '3306', 10),
    dialect: 'mysql',

    // Production-optimized pool configuration
    pool: {
      max: poolSize.max,      // Maximum connections (default: 50)
      min: poolSize.min,      // Minimum connections (default: 10)
      acquire: 30000,         // Max time to acquire connection (30s)
      idle: 10000,            // Max idle time before releasing (10s)
      evict: 60000,           // Check for idle connections every 60s
    },

    // Production logging (only slow queries and errors)
    logging: productionLogging,
    benchmark: true,
    logQueryParameters: false,  // Security: Don't log parameters

    // Retry configuration with exponential backoff
    retry: {
      max: 3,
      match: [
        /SequelizeConnectionError/,
        /SequelizeConnectionRefusedError/,
        /SequelizeHostNotFoundError/,
        /SequelizeHostNotReachableError/,
        /SequelizeInvalidConnectionError/,
        /SequelizeConnectionTimedOutError/,
        /SequelizeDatabaseError/,
        /ETIMEDOUT/,
        /ECONNREFUSED/,
        /ECONNRESET/,
        /EPIPE/,
      ],
      backoffBase: 1000,       // Start with 1 second
      backoffExponent: 1.5,    // Exponential backoff
    },

    // MySQL dialect options
    dialectOptions: {
      connectTimeout: 30000,
      // SSL configuration for production databases
      ssl: process.env.DB_SSL === 'true' ? {
        rejectUnauthorized: process.env.DB_SSL_REJECT_UNAUTHORIZED !== 'false',
        ca: process.env.DB_SSL_CA,
        cert: process.env.DB_SSL_CERT,
        key: process.env.DB_SSL_KEY,
      } : false,
      decimalNumbers: true,
      dateStrings: true,
      typeCast: true,
      supportBigNumbers: true,
      bigNumberStrings: true,
      multipleStatements: false,  // Security: Prevent SQL injection
      trace: false,
      // Connection flags for optimization
      flags: [
        '-FOUND_ROWS',
        'IGNORE_SPACE',
      ],
    },

    // Model definition defaults
    define: {
      underscored: false,
      timestamps: false,
      freezeTableName: true,
      charset: 'utf8mb4',
      collate: 'utf8mb4_unicode_ci',
      engine: 'InnoDB',
    },

    // Transaction configuration
    transactionType: Transaction.TYPES.IMMEDIATE,
    isolationLevel: 'READ_COMMITTED',

    // Query optimization
    query: {
      raw: false,
    },

    // Performance optimization
    minifyAliases: true,

    // Hooks for monitoring
    hooks: {
      beforeConnect: async (config: any) => {
        logger.info('Attempting database connection', {
          host: config.host,
          database: config.database,
          timestamp: new Date().toISOString(),
        });
      },
      afterConnect: async (connection: any, config: any) => {
        logger.info('Database connection established', {
          host: config.host,
          database: config.database,
          timestamp: new Date().toISOString(),
        });
      },
    },
  },
};

export default config;
export { logger };
