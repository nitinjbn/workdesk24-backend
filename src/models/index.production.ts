import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { initUser } from './schemas/User';
import { initHost } from './schemas/Host';
import { initRole } from './schemas/Role';
import { initPermission } from './schemas/Permission';
import { initRolePermission } from './schemas/RolePermission';
import { initUserPermission } from './schemas/UserPermission';
import { initInquiry } from './schemas/Inquiry';
import { initAttendance } from './schemas/Attendance';
import { initGpsHistory } from './schemas/GpsHistory';
import { initVisit } from './schemas/Visit';
import { initOrder } from './schemas/Order';
import { initOrderProduct } from './schemas/OrderProduct';
import { initPayment } from './schemas/Payment';
import { initFeedback } from './schemas/Feedback';
import { initImage } from './schemas/Image';
import { initAdminRefreshToken } from './schemas/AdminRefreshToken';
import config, { logger } from '../config/database';
import { DatabaseConnectionManager, type ConnectionMetrics, type HealthCheckResult } from '../shared/database/connection-manager';

dotenv.config();

/**
 * Production-Grade Database Initialization
 * CMM Level 5: Optimizing
 *
 * Features:
 * - Connection pool with optimal configuration
 * - Health monitoring and auto-recovery
 * - Performance metrics
 * - Graceful shutdown
 * - Circuit breaker pattern
 * - Production-safe logging
 */

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

// Validate required environment variables for all environments
const requiredVars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_HOST'];
const missing = requiredVars.filter((varName) => !process.env[varName]);

if (missing.length > 0) {
  logger.error('Missing required environment variables', {
    missing,
    env,
  });
  throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
}

// Log configuration (without sensitive data)
logger.info('Initializing database connection', {
  env,
  host: dbConfig.host,
  port: dbConfig.port,
  database: dbConfig.database,
  dialect: dbConfig.dialect,
  poolSize: {
    min: dbConfig.pool?.min,
    max: dbConfig.pool?.max,
  },
});

// Create Sequelize instance with production configuration
const sequelize = new Sequelize(
  dbConfig.database!,
  dbConfig.username!,
  dbConfig.password,
  dbConfig
);

// Create connection manager
const connectionManager = new DatabaseConnectionManager(sequelize);

// Initialize all models
const Host = initHost(sequelize);
const Role = initRole(sequelize);
const Permission = initPermission(sequelize);
const RolePermission = initRolePermission(sequelize);
const UserPermission = initUserPermission(sequelize);
const User = initUser(sequelize);
const Inquiry = initInquiry(sequelize);
const Attendance = initAttendance(sequelize);
const GpsHistory = initGpsHistory(sequelize);
const Visit = initVisit(sequelize);
const Order = initOrder(sequelize);
const OrderProduct = initOrderProduct(sequelize);
const Payment = initPayment(sequelize);
const Feedback = initFeedback(sequelize);
const Image = initImage(sequelize);
const AdminRefreshToken = initAdminRefreshToken(sequelize);

// Store models in an object
const db: any = {
  Host,
  Role,
  Permission,
  RolePermission,
  UserPermission,
  User,
  Inquiry,
  Attendance,
  GpsHistory,
  Visit,
  Order,
  OrderProduct,
  Payment,
  Feedback,
  Image,
  AdminRefreshToken,
  sequelize,
  Sequelize,
  connectionManager,
};

// Setup associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

/**
 * Initialize database connection with health monitoring
 * Call this from server.ts startup
 */
export async function initializeDatabase(): Promise<void> {
  try {
    await connectionManager.initialize();
    logger.info('Database initialized successfully');
  } catch (error: any) {
    logger.error('Failed to initialize database', {
      error: error.message,
      stack: error.stack,
    });
    throw error;
  }
}

/**
 * Get database health status
 */
export function getDatabaseStatus() {
  return connectionManager.getStatus();
}

/**
 * Get database metrics
 */
export function getDatabaseMetrics(): ConnectionMetrics {
  return connectionManager.getMetrics();
}

/**
 * Perform health check
 */
export async function performHealthCheck(): Promise<HealthCheckResult> {
  return connectionManager.healthCheck();
}

export {
  sequelize,
  Sequelize,
  Host,
  Role,
  Permission,
  RolePermission,
  UserPermission,
  User,
  Inquiry,
  Attendance,
  GpsHistory,
  Visit,
  Order,
  OrderProduct,
  Payment,
  Feedback,
  Image,
  AdminRefreshToken,
  connectionManager,
};

export default db;
