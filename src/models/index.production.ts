import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { initUser } from './schemas/User';
import { initHost } from './schemas/Host';
import { initHostSettings } from './schemas/HostSettings';
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
import { initCustomer } from './schemas/Customer';
import { initAdminRefreshToken } from './schemas/AdminRefreshToken';
import { initDesignation } from './schemas/Designation';
import config, { logger } from '../config/database';
import { DatabaseConnectionManager, type ConnectionMetrics, type HealthCheckResult } from '../shared/database/connection-manager';
import { initCustomerMedia } from './schemas/CustomerMedia';
import { initCustomerType } from './schemas/CustomerType';
import { initCustomerAttribute } from './schemas/CustomerAttributes';
import { initProduct } from './schemas/Product';
import { initProductBrand } from './schemas/ProductBrands';
import { initProductCategory } from './schemas/ProductCategories';
import { initProductAttribute } from './schemas/ProductAttributes';
import { initProductMedia } from './schemas/ProductMedia';
import { initUOM } from './schemas/UOM';

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

function validateRequiredEnv(): void {
  const requiredVars = ['DB_USER', 'DB_PASSWORD', 'DB_NAME', 'DB_HOST'];
  const missing = requiredVars.filter((varName) => !process.env[varName]);

  if (missing.length > 0) {
    logger.error('Missing required environment variables', {
      missing,
      env,
    });
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`);
  }
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
const HostSettings = initHostSettings(sequelize);
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
const Customer = initCustomer(sequelize);
const CustomerMedia = initCustomerMedia(sequelize);
const CustomerType = initCustomerType(sequelize);
const CustomerAttribute = initCustomerAttribute(sequelize);
const AdminRefreshToken = initAdminRefreshToken(sequelize);
const Designation = initDesignation(sequelize);
const Product = initProduct(sequelize);
const ProductCategory = initProductCategory(sequelize);
const ProductBrand = initProductBrand(sequelize);
const ProductAttribute = initProductAttribute(sequelize);
const ProductMedia = initProductMedia(sequelize);
const UOM = initUOM(sequelize);

// Store models in an object
const db: any = {
  Host,
  HostSettings,
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
  Customer,
  CustomerMedia,
  CustomerType,
  CustomerAttribute,
  AdminRefreshToken,
  Designation,
  Product,
  ProductCategory,
  ProductBrand,
  ProductAttribute,
  ProductMedia,
  UOM,
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
    validateRequiredEnv();
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
  HostSettings,
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
  Customer,
  CustomerMedia,
  CustomerAttribute,
  CustomerType,
  AdminRefreshToken,
  Designation,
  Product,
  ProductCategory,
  ProductBrand,
  ProductAttribute,
  ProductMedia,
  UOM,
  connectionManager,
};

export default db;
