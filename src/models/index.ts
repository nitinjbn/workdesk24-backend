import { Sequelize } from 'sequelize';
import dotenv from 'dotenv';
import { initUser } from './schemas/User';
import { initInquiry } from './schemas/Inquiry';
import { initAttendance } from './schemas/Attendance';
import { initGpsHistory } from './schemas/GpsHistory';
import { initVisit } from './schemas/Visit';
import { initOrder } from './schemas/Order';
import { initOrderProduct } from './schemas/OrderProduct';
import { initPayment } from './schemas/Payment';
import { initFeedback } from './schemas/Feedback';
import { initImage } from './schemas/Image';
import config from '../config/database';

dotenv.config();

const env = process.env.NODE_ENV || 'development';
const dbConfig = config[env];

const sequelize = new Sequelize(
  dbConfig.database!,
  dbConfig.username!,
  dbConfig.password,
  dbConfig
);

// Initialize all models
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

// Store models in an object
const db: any = {
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
  sequelize,
  Sequelize,
};

// Setup associations
Object.keys(db).forEach((modelName) => {
  if (db[modelName].associate) {
    db[modelName].associate(db);
  }
});

export {
  sequelize,
  Sequelize,
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
};

export default db;
