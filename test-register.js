require('dotenv').config();
const { Sequelize, DataTypes } = require('sequelize');
const bcrypt = require('bcryptjs');

// Create sequelize instance
const sequelize = new Sequelize(
  process.env.DB_NAME,
  process.env.DB_USER,
  process.env.DB_PASSWORD,
  {
    host: process.env.DB_HOST,
    dialect: 'mysql',
    logging: console.log, // Enable logging to see SQL
    define: {
      underscored: false,
      timestamps: false
    }
  }
);

// Define User model
const User = sequelize.define('User', {
  id: {
    type: DataTypes.INTEGER.UNSIGNED,
    autoIncrement: true,
    primaryKey: true,
  },
  email: {
    type: DataTypes.STRING(255),
    allowNull: false,
    unique: true,
  },
  password: {
    type: DataTypes.STRING(255),
    allowNull: false,
  },
  name: {
    type: DataTypes.STRING(100),
    allowNull: true,
  },
  role: {
    type: DataTypes.ENUM('admin', 'staff', 'user'),
    allowNull: false,
    defaultValue: 'user',
  },
  isActive: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 1,
  },
  lastLoginAt: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: null,
  },
  createdAt: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  updatedAt: {
    type: DataTypes.BIGINT,
    allowNull: false,
  },
  isDeleted: {
    type: DataTypes.TINYINT,
    allowNull: false,
    defaultValue: 0,
  },
  deletedAt: {
    type: DataTypes.BIGINT,
    allowNull: true,
    defaultValue: null,
  },
}, {
  sequelize,
  tableName: 'wd_users',
  timestamps: false,
  underscored: false,
});

async function testCreate() {
  try {
    console.log('\n=== Testing User.create() ===\n');

    const now = Math.floor(Date.now() / 1000);
    const hashedPassword = await bcrypt.hash('Test123!', 10);

    const user = await User.create({
      email: 'test' + Date.now() + '@example.com',
      password: hashedPassword,
      name: 'Test User',
      role: 'user',
      isActive: 1,
      lastLoginAt: null,
      createdAt: now,
      updatedAt: now,
      isDeleted: 0,
      deletedAt: null
    });

    console.log('\n✅ User created successfully:');
    console.log(JSON.stringify(user.toJSON(), null, 2));
    process.exit(0);
  } catch (error) {
    console.error('\n❌ Error:', error.message);
    if (error.sql) {
      console.error('SQL:', error.sql);
    }
    process.exit(1);
  }
}

testCreate();
