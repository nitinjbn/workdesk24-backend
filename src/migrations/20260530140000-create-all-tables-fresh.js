'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = Math.floor(Date.now() / 1000);

    // 1. Create wd_users table
    await queryInterface.createTable('wd_users', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
        unique: true,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      role: {
        type: Sequelize.ENUM('admin', 'staff', 'user'),
        defaultValue: 'user',
        allowNull: false,
      },
      isActive: {
        type: Sequelize.TINYINT,
        defaultValue: 1,
        allowNull: false,
      },
      lastLoginAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_users', ['email']);
    await queryInterface.addIndex('wd_users', ['isDeleted']);
    await queryInterface.addIndex('wd_users', ['role']);

    // 2. Create wd_attendance table
    await queryInterface.createTable('wd_attendance', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'wd_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      checkInTime: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      checkOutTime: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      checkInLat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      checkInLng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      checkOutLat: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      checkOutLng: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      workingHours: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('checked_in', 'checked_out'),
        defaultValue: 'checked_in',
        allowNull: false,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_attendance', ['userId']);
    await queryInterface.addIndex('wd_attendance', ['localId']);
    await queryInterface.addIndex('wd_attendance', ['checkInTime']);
    await queryInterface.addIndex('wd_attendance', ['status']);
    await queryInterface.addIndex('wd_attendance', ['isDeleted']);

    // 3. Create wd_gps_history table
    await queryInterface.createTable('wd_gps_history', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'wd_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false,
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false,
      },
      accuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      altitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      speed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      bearing: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      timestamp: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      batteryLevel: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      activityType: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_gps_history', ['userId']);
    await queryInterface.addIndex('wd_gps_history', ['timestamp']);
    await queryInterface.addIndex('wd_gps_history', ['localId']);
    await queryInterface.addIndex('wd_gps_history', ['isDeleted']);

    // 4. Create wd_visits table
    await queryInterface.createTable('wd_visits', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'wd_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      customerName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      customerPhone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      customerEmail: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      address: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      visitType: {
        type: Sequelize.ENUM('meeting', 'delivery', 'support', 'sales', 'other'),
        defaultValue: 'meeting',
        allowNull: false,
      },
      purpose: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      checkInTime: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      checkOutTime: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      duration: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('scheduled', 'in_progress', 'completed', 'cancelled'),
        defaultValue: 'scheduled',
        allowNull: false,
      },
      outcome: {
        type: Sequelize.ENUM('success', 'failed', 'rescheduled', 'not_available'),
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_visits', ['userId']);
    await queryInterface.addIndex('wd_visits', ['localId']);
    await queryInterface.addIndex('wd_visits', ['checkInTime']);
    await queryInterface.addIndex('wd_visits', ['status']);
    await queryInterface.addIndex('wd_visits', ['visitType']);
    await queryInterface.addIndex('wd_visits', ['isDeleted']);

    // 5. Create wd_orders table
    await queryInterface.createTable('wd_orders', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'wd_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      customerName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      customerPhone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      customerEmail: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      orderNumber: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      orderDate: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.00,
      },
      paidAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.00,
      },
      status: {
        type: Sequelize.ENUM('pending', 'confirmed', 'processing', 'delivered', 'cancelled'),
        defaultValue: 'pending',
        allowNull: false,
      },
      paymentStatus: {
        type: Sequelize.ENUM('pending', 'partial', 'paid'),
        defaultValue: 'pending',
        allowNull: false,
      },
      items: {
        type: Sequelize.JSON,
        allowNull: true,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_orders', ['userId']);
    await queryInterface.addIndex('wd_orders', ['localId']);
    await queryInterface.addIndex('wd_orders', ['orderNumber']);
    await queryInterface.addIndex('wd_orders', ['orderDate']);
    await queryInterface.addIndex('wd_orders', ['status']);
    await queryInterface.addIndex('wd_orders', ['isDeleted']);

    // 6. Create wd_payments table
    await queryInterface.createTable('wd_payments', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'wd_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      orderId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'wd_orders',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      customerName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      paymentAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      paymentDate: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      paymentMethod: {
        type: Sequelize.ENUM('cash', 'card', 'upi', 'bank_transfer', 'cheque', 'other'),
        defaultValue: 'cash',
        allowNull: false,
      },
      transactionId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      status: {
        type: Sequelize.ENUM('pending', 'completed', 'failed', 'refunded'),
        defaultValue: 'completed',
        allowNull: false,
      },
      notes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_payments', ['userId']);
    await queryInterface.addIndex('wd_payments', ['orderId']);
    await queryInterface.addIndex('wd_payments', ['localId']);
    await queryInterface.addIndex('wd_payments', ['paymentDate']);
    await queryInterface.addIndex('wd_payments', ['status']);
    await queryInterface.addIndex('wd_payments', ['paymentMethod']);
    await queryInterface.addIndex('wd_payments', ['isDeleted']);

    // 7. Create wd_feedback table
    await queryInterface.createTable('wd_feedback', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'wd_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      customerName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      customerPhone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      customerEmail: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      feedbackDate: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      rating: {
        type: Sequelize.INTEGER,
        allowNull: false,
      },
      comments: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      category: {
        type: Sequelize.ENUM('service', 'product', 'delivery', 'support', 'other'),
        defaultValue: 'service',
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'reviewed', 'resolved'),
        defaultValue: 'pending',
        allowNull: false,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_feedback', ['userId']);
    await queryInterface.addIndex('wd_feedback', ['localId']);
    await queryInterface.addIndex('wd_feedback', ['feedbackDate']);
    await queryInterface.addIndex('wd_feedback', ['rating']);
    await queryInterface.addIndex('wd_feedback', ['category']);
    await queryInterface.addIndex('wd_feedback', ['isDeleted']);

    // 8. Create wd_images table
    await queryInterface.createTable('wd_images', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
        references: {
          model: 'wd_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'CASCADE',
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      fileName: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      filePath: {
        type: Sequelize.STRING(500),
        allowNull: false,
      },
      fileSize: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      mimeType: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      entityType: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      entityId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
      },
      latitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      longitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      capturedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_images', ['userId']);
    await queryInterface.addIndex('wd_images', ['localId']);
    await queryInterface.addIndex('wd_images', ['entityType', 'entityId']);
    await queryInterface.addIndex('wd_images', ['isDeleted']);

    // 9. Create wd_inquiries table
    await queryInterface.createTable('wd_inquiries', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      phone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      subject: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: false,
      },
      status: {
        type: Sequelize.ENUM('pending', 'in_progress', 'resolved', 'closed'),
        defaultValue: 'pending',
        allowNull: false,
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium',
        allowNull: false,
      },
      source: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      ipAddress: {
        type: Sequelize.STRING(45),
        allowNull: true,
      },
      userAgent: {
        type: Sequelize.STRING(500),
        allowNull: true,
      },
      assignedTo: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: true,
        references: {
          model: 'wd_users',
          key: 'id',
        },
        onUpdate: 'CASCADE',
        onDelete: 'SET NULL',
      },
      adminNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      resolvedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        defaultValue: 0,
        allowNull: false,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_inquiries', ['email']);
    await queryInterface.addIndex('wd_inquiries', ['status']);
    await queryInterface.addIndex('wd_inquiries', ['priority']);
    await queryInterface.addIndex('wd_inquiries', ['assignedTo']);
    await queryInterface.addIndex('wd_inquiries', ['createdAt']);
    await queryInterface.addIndex('wd_inquiries', ['isDeleted']);

    // 10. Seed admin user
    const hashedPassword = await bcrypt.hash('admin123', 10);
    await queryInterface.bulkInsert('wd_users', [
      {
        id: 1,
        email: 'admin@workdesk24.com',
        password: hashedPassword,
        name: 'System Administrator',
        role: 'admin',
        isActive: 1,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: 0,
        deletedAt: null,
      },
    ]);

    console.log('✅ All 9 tables created with camelCase, BIGINT timestamps, and soft delete');
    console.log('✅ Admin user created: admin@workdesk24.com / admin123');
  },

  async down(queryInterface, Sequelize) {
    await queryInterface.dropTable('wd_images');
    await queryInterface.dropTable('wd_feedback');
    await queryInterface.dropTable('wd_payments');
    await queryInterface.dropTable('wd_orders');
    await queryInterface.dropTable('wd_visits');
    await queryInterface.dropTable('wd_gps_history');
    await queryInterface.dropTable('wd_attendance');
    await queryInterface.dropTable('wd_inquiries');
    await queryInterface.dropTable('wd_users');
  },
};
