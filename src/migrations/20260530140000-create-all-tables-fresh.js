'use strict';

const bcrypt = require('bcryptjs');

/** @type {import('sequelize-cli').Migration} */
module.exports = {
  async up(queryInterface, Sequelize) {
    const now = Math.floor(Date.now() / 1000);

    // 1. wd_hosts
    await queryInterface.createTable('wd_hosts', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      contactPerson: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      mobile: {
        type: Sequelize.STRING(20),
        allowNull: true,
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
      companyName: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      companyLogoUrl: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      websiteUrl: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      addressLine1: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      addressLine2: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      city: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      state: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      postalCode: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      country: {
        type: Sequelize.STRING(100),
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
      gstNumber: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      panNumber: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      isActive: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      lastLoginAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
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
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    // 2. wd_roles
    await queryInterface.createTable('wd_roles', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      roleCode: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      roleName: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      remarks: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      isSystemRole: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      isEnabled: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_roles', ['hostId']);
    await queryInterface.addIndex('wd_roles', ['roleCode']);
    await queryInterface.addIndex('wd_roles', ['roleName']);
    await queryInterface.addIndex('wd_roles', ['isSystemRole']);
    await queryInterface.addIndex('wd_roles', ['isEnabled']);
    await queryInterface.addIndex('wd_roles', ['isDeleted']);

    // 3. wd_users
    await queryInterface.createTable('wd_users', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      hostId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      roleId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      employeeId: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      name: {
        type: Sequelize.STRING(100),
        allowNull: false,
      },
      email: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      mobile: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      password: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      reportingManagerId: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      profileImageUrl: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      joiningDate: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      lastLoginAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
      isActive: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 1,
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
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    // 4. wd_inquiries
    await queryInterface.createTable('wd_inquiries', {
      id: {
        type: Sequelize.INTEGER,
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
      },
      priority: {
        type: Sequelize.ENUM('low', 'medium', 'high', 'urgent'),
        defaultValue: 'medium',
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
      },
      adminNotes: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      source: {
        type: Sequelize.STRING(50),
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
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    // 5. wd_attendance
    await queryInterface.createTable('wd_attendance', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      attendanceStatus: {
        type: Sequelize.STRING(20),
        allowNull: false,
      },
      vehicleType: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      vehicleCategory: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      attendanceOdometerReading: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      attendanceImage: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      attendanceRemarks: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      attendanceLatitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: false,
      },
      attendanceLongitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: false,
      },
      attendanceLocationAccuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      attendanceLocationAltitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      attendanceLocationSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      attendanceLocationProvider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      attendanceBatteryPercentage: {
        type: Sequelize.SMALLINT,
        allowNull: true,
      },
      isChargingOnAttendance: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      dayoverImage: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      dayoverOdometerReading: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      dayoverLatitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      dayoverLongitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      dayoverLocationAccuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      dayoverLocationAltitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      dayoverLocationSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      dayoverLocationProvider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      dayoverBatteryPercentage: {
        type: Sequelize.SMALLINT,
        allowNull: true,
      },
      isChargingOnDayover: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      dayoverRemarks: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      attendanceTime: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      dayoverTime: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      workingHours: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_attendance', ['userId']);
    await queryInterface.addIndex('wd_attendance', ['localId']);
    await queryInterface.addIndex('wd_attendance', ['attendanceStatus']);

    // 6. wd_gps_history
    await queryInterface.createTable('wd_gps_history', {
      id: {
        type: Sequelize.INTEGER.UNSIGNED,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.INTEGER.UNSIGNED,
        allowNull: false,
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
      provider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      batteryPercentage: {
        type: Sequelize.INTEGER,
        allowNull: true,
      },
      isCharging: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
    });

    await queryInterface.addIndex('wd_gps_history', ['userId']);
    await queryInterface.addIndex('wd_gps_history', ['localId']);

    // 7. wd_visits
    await queryInterface.createTable('wd_visits', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      customerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      customerName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      customerCode: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      contactPerson: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      customerPhone: {
        type: Sequelize.STRING(20),
        allowNull: true,
      },
      customerEmail: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      customerAddress: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      customerType: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      purpose: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      remarks: {
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
      visitDuration: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      checkInLatitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      checkInLongitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      checkInLocationAccuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      checkInLocationAltitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      checkInLocationSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      checkInLocationProvider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      checkInBatteryPercentage: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      isChargingOnCheckIn: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      checkOutLatitude: {
        type: Sequelize.DECIMAL(10, 8),
        allowNull: true,
      },
      checkOutLongitude: {
        type: Sequelize.DECIMAL(11, 8),
        allowNull: true,
      },
      checkOutLocationAccuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      checkOutLocationAltitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      checkOutLocationSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      checkOutLocationProvider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      checkOutBatteryPercentage: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      isChargingOnCheckOut: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_visits', ['userId']);
    await queryInterface.addIndex('wd_visits', ['localId']);
    await queryInterface.addIndex('wd_visits', ['customerId']);
    await queryInterface.addIndex('wd_visits', ['checkInTime']);
    await queryInterface.addIndex('wd_visits', ['checkOutTime']);
    await queryInterface.addIndex('wd_visits', ['visitDuration']);

    // 8. wd_orders
    await queryInterface.createTable('wd_orders', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      visitId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      customerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      orderNumber: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
        defaultValue: 0.0,
      },
      taxAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      totalDiscount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
        defaultValue: 0.0,
      },
      totalUniqueProducts: {
        type: Sequelize.TINYINT,
        allowNull: true,
        defaultValue: 0,
      },
      totalQuantity: {
        type: Sequelize.INTEGER,
        allowNull: true,
        defaultValue: 0,
      },
      orderTime: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      remarks: {
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
      locationAccuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationAltitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationProvider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      batteryPercentage: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      isCharging: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_orders', ['userId']);
    await queryInterface.addIndex('wd_orders', ['localId']);
    await queryInterface.addIndex('wd_orders', ['customerId']);
    await queryInterface.addIndex('wd_orders', ['visitId']);
    await queryInterface.addIndex('wd_orders', ['orderNumber']);
    await queryInterface.addIndex('wd_orders', ['orderTime']);

    // 9. wd_orders_products
    await queryInterface.createTable('wd_orders_products', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      orderId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      visitId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      customerId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      productId: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      productName: {
        type: Sequelize.STRING(200),
        allowNull: false,
      },
      productCode: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      quantity: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      mrp: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      discountPercentage: {
        type: Sequelize.DECIMAL(5, 2),
        allowNull: true,
      },
      discountAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      taxAmount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: true,
      },
      totalAmount: {
        type: Sequelize.DECIMAL(10, 2),
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
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_orders_products', ['orderId']);
    await queryInterface.addIndex('wd_orders_products', ['userId']);
    await queryInterface.addIndex('wd_orders_products', ['localId']);
    await queryInterface.addIndex('wd_orders_products', ['productId']);
    await queryInterface.addIndex('wd_orders_products', ['visitId']);
    await queryInterface.addIndex('wd_orders_products', ['customerId']);

    // 10. wd_payments
    await queryInterface.createTable('wd_payments', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      visitId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      amount: {
        type: Sequelize.DECIMAL(10, 2),
        allowNull: false,
      },
      paymentMode: {
        type: Sequelize.STRING(50),
        allowNull: false,
      },
      paymentDate: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      remarks: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      chequeNumber: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      transactionId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      paymentProofImageUrl: {
        type: Sequelize.STRING(255),
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
      locationAccuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationAltitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationProvider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      batteryPercentage: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      isChargingOnPayment: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      paymentCaptureTime: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_payments', ['userId']);
    await queryInterface.addIndex('wd_payments', ['localId']);
    await queryInterface.addIndex('wd_payments', ['visitId']);
    await queryInterface.addIndex('wd_payments', ['paymentDate']);

    // 11. wd_feedbacks
    await queryInterface.createTable('wd_feedbacks', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      visitId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      message: {
        type: Sequelize.TEXT,
        allowNull: true,
      },
      mediaUrl: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      mediaType: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      feedbackTime: {
        type: Sequelize.BIGINT,
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
      locationAccuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationAltitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationProvider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      batteryPercentage: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      isChargingOnFeedback: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_feedbacks', ['userId']);
    await queryInterface.addIndex('wd_feedbacks', ['localId']);
    await queryInterface.addIndex('wd_feedbacks', ['visitId']);
    await queryInterface.addIndex('wd_feedbacks', ['feedbackTime']);

    // 12. wd_images
    await queryInterface.createTable('wd_images', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      localId: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      visitId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      caption: {
        type: Sequelize.STRING(255),
        allowNull: true,
      },
      mediaUrl: {
        type: Sequelize.STRING(255),
        allowNull: false,
      },
      mediaType: {
        type: Sequelize.STRING(50),
        allowNull: true,
      },
      capturedAt: {
        type: Sequelize.BIGINT,
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
      locationAccuracy: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationAltitude: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationSpeed: {
        type: Sequelize.FLOAT,
        allowNull: true,
      },
      locationProvider: {
        type: Sequelize.STRING(100),
        allowNull: true,
      },
      batteryPercentage: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      isCharging: {
        type: Sequelize.TINYINT,
        allowNull: true,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      syncedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
      },
      isDeleted: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
      deletedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
    });

    await queryInterface.addIndex('wd_images', ['userId']);
    await queryInterface.addIndex('wd_images', ['localId']);
    await queryInterface.addIndex('wd_images', ['visitId']);
    await queryInterface.addIndex('wd_images', ['capturedAt']);

    // 13. wd_admin_refresh_tokens
    await queryInterface.createTable('wd_admin_refresh_tokens', {
      id: {
        type: Sequelize.BIGINT,
        autoIncrement: true,
        primaryKey: true,
      },
      userId: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      tokenHash: {
        type: Sequelize.STRING(128),
        allowNull: false,
        unique: true,
      },
      tokenFamily: {
        type: Sequelize.STRING(64),
        allowNull: false,
      },
      expiresAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      createdAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      updatedAt: {
        type: Sequelize.BIGINT,
        allowNull: false,
      },
      revokedAt: {
        type: Sequelize.BIGINT,
        allowNull: true,
        defaultValue: null,
      },
      replacedByTokenHash: {
        type: Sequelize.STRING(128),
        allowNull: true,
        defaultValue: null,
      },
      isRevoked: {
        type: Sequelize.TINYINT,
        allowNull: false,
        defaultValue: 0,
      },
    });

    await queryInterface.addIndex('wd_admin_refresh_tokens', ['userId']);
    await queryInterface.addIndex('wd_admin_refresh_tokens', ['tokenHash'], { unique: true });
    await queryInterface.addIndex('wd_admin_refresh_tokens', ['tokenFamily']);
    await queryInterface.addIndex('wd_admin_refresh_tokens', ['expiresAt']);
    await queryInterface.addIndex('wd_admin_refresh_tokens', ['isRevoked']);

    // Seed host, role, admin user
    const hashedHostPassword = await bcrypt.hash('host123', 10);
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);

    await queryInterface.bulkInsert('wd_hosts', [
      {
        id: 1,
        contactPerson: 'System Owner',
        mobile: '9999999999',
        email: 'owner@workdesk24.com',
        password: hashedHostPassword,
        companyName: 'Workdesk24',
        companyLogoUrl: null,
        websiteUrl: null,
        addressLine1: null,
        addressLine2: null,
        city: null,
        state: null,
        postalCode: null,
        country: null,
        latitude: null,
        longitude: null,
        gstNumber: null,
        panNumber: null,
        isActive: 1,
        lastLoginAt: null,
        createdAt: now,
        updatedAt: now,
        isDeleted: 0,
        deletedAt: null,
      },
    ]);

    await queryInterface.bulkInsert('wd_roles', [
      {
        id: 1,
        hostId: 1,
        roleCode: 'ADMIN',
        roleName: 'Administrator',
        remarks: 'Default admin role',
        isSystemRole: 1,
        isEnabled: 1,
        isDeleted: 0,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      },
    ]);

    await queryInterface.bulkInsert('wd_users', [
      {
        id: 1,
        hostId: 1,
        roleId: 1,
        employeeId: null,
        name: 'System Administrator',
        email: 'admin@workdesk24.com',
        mobile: '9999999998',
        password: hashedAdminPassword,
        reportingManagerId: null,
        profileImageUrl: null,
        joiningDate: now,
        lastLoginAt: null,
        isActive: 1,
        createdAt: now,
        updatedAt: now,
        isDeleted: 0,
        deletedAt: null,
      },
    ]);

    console.log('✅ Schema synced with latest active models');
    console.log('✅ Seeded default host, admin role, and admin user');
  },

  async down(queryInterface) {
    await queryInterface.dropTable('wd_admin_refresh_tokens');
    await queryInterface.dropTable('wd_images');
    await queryInterface.dropTable('wd_feedbacks');
    await queryInterface.dropTable('wd_payments');
    await queryInterface.dropTable('wd_orders_products');
    await queryInterface.dropTable('wd_orders');
    await queryInterface.dropTable('wd_visits');
    await queryInterface.dropTable('wd_gps_history');
    await queryInterface.dropTable('wd_attendance');
    await queryInterface.dropTable('wd_inquiries');
    await queryInterface.dropTable('wd_users');
    await queryInterface.dropTable('wd_roles');
    await queryInterface.dropTable('wd_hosts');
  },
};
