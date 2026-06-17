-- MySQL dump 10.13  Distrib 8.0.44, for Win64 (x86_64)
--
-- Host: localhost    Database: learning
-- ------------------------------------------------------
-- Server version	5.7.43-log

/*!40101 SET @OLD_CHARACTER_SET_CLIENT=@@CHARACTER_SET_CLIENT */;
/*!40101 SET @OLD_CHARACTER_SET_RESULTS=@@CHARACTER_SET_RESULTS */;
/*!40101 SET @OLD_COLLATION_CONNECTION=@@COLLATION_CONNECTION */;
/*!50503 SET NAMES utf8 */;
/*!40103 SET @OLD_TIME_ZONE=@@TIME_ZONE */;
/*!40103 SET TIME_ZONE='+00:00' */;
/*!40014 SET @OLD_UNIQUE_CHECKS=@@UNIQUE_CHECKS, UNIQUE_CHECKS=0 */;
/*!40014 SET @OLD_FOREIGN_KEY_CHECKS=@@FOREIGN_KEY_CHECKS, FOREIGN_KEY_CHECKS=0 */;
/*!40101 SET @OLD_SQL_MODE=@@SQL_MODE, SQL_MODE='NO_AUTO_VALUE_ON_ZERO' */;
/*!40111 SET @OLD_SQL_NOTES=@@SQL_NOTES, SQL_NOTES=0 */;

--
-- Table structure for table `sequelizemeta`
--

DROP TABLE IF EXISTS `sequelizemeta`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `sequelizemeta` (
  `name` varchar(255) COLLATE utf8_unicode_ci NOT NULL,
  PRIMARY KEY (`name`),
  UNIQUE KEY `name` (`name`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8 COLLATE=utf8_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `sequelizemeta`
--

LOCK TABLES `sequelizemeta` WRITE;
/*!40000 ALTER TABLE `sequelizemeta` DISABLE KEYS */;
INSERT INTO `sequelizemeta` VALUES ('20260530140000-create-all-tables-fresh.js');
/*!40000 ALTER TABLE `sequelizemeta` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_attendance`
--

DROP TABLE IF EXISTS `wd_attendance`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_attendance` (
  `id` bigint(20) NOT NULL AUTO_INCREMENT,
  `userId` bigint(20) NOT NULL,
  `localId` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendanceStatus` varchar(20) COLLATE utf8mb4_unicode_ci NOT NULL,
  `vehicleType` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `vehicleCategory` varchar(20) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendanceOdometerReading` int(11) DEFAULT NULL,
  `attendanceImage` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendanceRemarks` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendanceLatitude` decimal(10,8) NOT NULL,
  `attendanceLongitude` decimal(11,8) NOT NULL,
  `attendanceLocationAccuracy` float DEFAULT NULL,
  `attendanceLocationAltitude` float DEFAULT NULL,
  `attendanceLocationSpeed` float DEFAULT NULL,
  `attendanceLocationProvider` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendanceBatteryPercentage` smallint(6) DEFAULT NULL,
  `isChargingOnAttendance` tinyint(4) DEFAULT NULL,
  `dayoverLatitude` decimal(10,8) DEFAULT NULL,
  `dayoverLongitude` decimal(11,8) DEFAULT NULL,
  `dayoverLocationAccuracy` float DEFAULT NULL,
  `dayoverLocationAltitude` float DEFAULT NULL,
  `dayoverLocationSpeed` float DEFAULT NULL,
  `dayoverLocationProvider` varchar(100) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `dayoverBatteryPercentage` smallint(6) DEFAULT NULL,
  `isChargingOnDayover` tinyint(4) DEFAULT NULL,
  `dayoverRemarks` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `attendanceTime` bigint(20) NOT NULL,
  `dayoverTime` bigint(20) DEFAULT NULL,
  `workingHours` float DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) DEFAULT NULL,
  `syncedAt` bigint(20) DEFAULT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `idx_wd_attendance_userId` (`userId`),
  KEY `idx_wd_attendance_localId` (`localId`),
  KEY `idx_wd_attendance_attendanceStatus` (`attendanceStatus`)
) ENGINE=InnoDB AUTO_INCREMENT=4 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_attendance`
--

LOCK TABLES `wd_attendance` WRITE;
/*!40000 ALTER TABLE `wd_attendance` DISABLE KEYS */;
INSERT INTO `wd_attendance` VALUES (1,2,'att_001','Present','TWO Wheeler','PRIVATE',123456,'','Attendance Remarks',28.61390000,77.20910000,5.7,123,5.4,'FUSED',89,1,28.61390000,77.20910000,5.7,123,5.4,'FUSED',89,1,'Dayover Remarks',1234567890,9876543210,8.5,1780827983,1780827983,1780827983,0,NULL),(2,2,'att_1','Present','Two Wheeler','Private',123456,'','',37.42199830,-122.08400000,5,5,0,'fused',100,0,37.42199830,-122.08400000,5,5,0,'fused',100,0,'',1779077828,1779078307,0.133129,1780828681,1780828681,1780828681,0,NULL),(3,2,'att_2','Present','Two Wheeler','Private',NULL,'','',37.42199830,-122.08400000,5,5,0,'fused',100,0,37.42199830,-122.08400000,5,5,0,'fused',100,0,'',1779085121,1779116820,8.80534,1780830845,1780830845,1780830845,0,NULL);
/*!40000 ALTER TABLE `wd_attendance` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_attendance_old`
--

DROP TABLE IF EXISTS `wd_attendance_old`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_attendance_old` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `userId` int(10) unsigned NOT NULL,
  `localId` varchar(100) DEFAULT NULL,
  `checkInTime` bigint(20) NOT NULL,
  `checkOutTime` bigint(20) DEFAULT NULL,
  `checkInLat` decimal(10,8) DEFAULT NULL,
  `checkInLng` decimal(11,8) DEFAULT NULL,
  `checkOutLat` decimal(10,8) DEFAULT NULL,
  `checkOutLng` decimal(11,8) DEFAULT NULL,
  `workingHours` decimal(5,2) DEFAULT NULL,
  `status` enum('checked_in','checked_out') NOT NULL DEFAULT 'checked_in',
  `notes` text,
  `syncedAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wd_attendance_user_id` (`userId`),
  KEY `wd_attendance_local_id` (`localId`),
  KEY `wd_attendance_check_in_time` (`checkInTime`),
  KEY `wd_attendance_status` (`status`),
  KEY `wd_attendance_is_deleted` (`isDeleted`),
  CONSTRAINT `wd_attendance_old_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_attendance_old`
--

LOCK TABLES `wd_attendance_old` WRITE;
/*!40000 ALTER TABLE `wd_attendance_old` DISABLE KEYS */;
/*!40000 ALTER TABLE `wd_attendance_old` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_feedback`
--

DROP TABLE IF EXISTS `wd_feedback`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_feedback` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `userId` int(10) unsigned NOT NULL,
  `localId` varchar(100) DEFAULT NULL,
  `customerName` varchar(200) NOT NULL,
  `customerPhone` varchar(20) DEFAULT NULL,
  `customerEmail` varchar(255) DEFAULT NULL,
  `feedbackDate` bigint(20) NOT NULL,
  `rating` int(11) NOT NULL,
  `comments` text,
  `category` enum('service','product','delivery','support','other') NOT NULL DEFAULT 'service',
  `status` enum('pending','reviewed','resolved') NOT NULL DEFAULT 'pending',
  `syncedAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wd_feedback_user_id` (`userId`),
  KEY `wd_feedback_local_id` (`localId`),
  KEY `wd_feedback_feedback_date` (`feedbackDate`),
  KEY `wd_feedback_rating` (`rating`),
  KEY `wd_feedback_category` (`category`),
  KEY `wd_feedback_is_deleted` (`isDeleted`),
  CONSTRAINT `wd_feedback_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_feedback`
--

LOCK TABLES `wd_feedback` WRITE;
/*!40000 ALTER TABLE `wd_feedback` DISABLE KEYS */;
/*!40000 ALTER TABLE `wd_feedback` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_gps_history`
--

DROP TABLE IF EXISTS `wd_gps_history`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_gps_history` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `userId` int(10) unsigned NOT NULL,
  `localId` varchar(100) DEFAULT NULL,
  `latitude` decimal(10,8) NOT NULL,
  `longitude` decimal(11,8) NOT NULL,
  `accuracy` float DEFAULT NULL,
  `altitude` float DEFAULT NULL,
  `speed` float DEFAULT NULL,
  `provider` varchar(50) DEFAULT NULL,
  `batteryPercentage` smallint(3) DEFAULT NULL,
  `isCharging` tinyint(1) DEFAULT NULL,
  `syncedAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wd_gps_history_user_id` (`userId`),
  KEY `wd_gps_history_local_id` (`localId`),
  KEY `wd_gps_history_is_deleted` (`isDeleted`),
  CONSTRAINT `wd_gps_history_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB AUTO_INCREMENT=24 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_gps_history`
--

LOCK TABLES `wd_gps_history` WRITE;
/*!40000 ALTER TABLE `wd_gps_history` DISABLE KEYS */;
INSERT INTO `wd_gps_history` VALUES (1,2,'gps_1',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(2,2,'gps_2',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(3,2,'gps_3',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(4,2,'gps_4',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(5,2,'gps_5',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(6,2,'gps_6',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(7,2,'gps_7',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(8,2,'gps_8',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(9,2,'gps_9',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(10,2,'gps_10',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(11,2,'gps_11',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(12,2,'gps_12',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(13,2,'gps_13',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(14,2,'gps_14',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(15,2,'gps_15',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(16,2,'gps_16',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(17,2,'gps_17',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(18,2,'gps_18',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(19,2,'gps_19',37.42199830,-122.08400000,5,5,0,NULL,100,NULL,1780737773,1780737773,1780737773,0,NULL),(20,2,'gps_001',28.61390000,77.20900000,5.2,220.5,0,'Fused',85,NULL,1780741006,1780731613,1780741006,0,NULL),(21,2,'gps_00100',28.61390000,77.20900000,5.2,220.5,0,'Fused',89,1,1780741753,1780731613,1780741753,0,NULL),(22,2,'gps_00199',28.61390000,77.20900000,5.2,220.5,0,'Fused',89,1,1780741786,1780731613,1780741786,0,NULL),(23,2,'gps_20',37.42199830,-122.08400000,5,5,0,'fused',100,0,1780828680,1780753663,1780828680,0,NULL);
/*!40000 ALTER TABLE `wd_gps_history` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_images`
--

DROP TABLE IF EXISTS `wd_images`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_images` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `userId` int(10) unsigned NOT NULL,
  `localId` varchar(100) DEFAULT NULL,
  `fileName` varchar(255) NOT NULL,
  `filePath` varchar(500) NOT NULL,
  `fileSize` int(11) DEFAULT NULL,
  `mimeType` varchar(100) DEFAULT NULL,
  `entityType` varchar(50) NOT NULL,
  `entityId` int(10) unsigned NOT NULL,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `capturedAt` bigint(20) DEFAULT NULL,
  `syncedAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wd_images_user_id` (`userId`),
  KEY `wd_images_local_id` (`localId`),
  KEY `wd_images_entity_type_entity_id` (`entityType`,`entityId`),
  KEY `wd_images_is_deleted` (`isDeleted`),
  CONSTRAINT `wd_images_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_images`
--

LOCK TABLES `wd_images` WRITE;
/*!40000 ALTER TABLE `wd_images` DISABLE KEYS */;
/*!40000 ALTER TABLE `wd_images` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_inquiries`
--

DROP TABLE IF EXISTS `wd_inquiries`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_inquiries` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) NOT NULL,
  `email` varchar(255) NOT NULL,
  `phone` varchar(20) DEFAULT NULL,
  `subject` varchar(200) NOT NULL,
  `message` text NOT NULL,
  `status` enum('pending','in_progress','resolved','closed') NOT NULL DEFAULT 'pending',
  `priority` enum('low','medium','high','urgent') NOT NULL DEFAULT 'medium',
  `source` varchar(50) DEFAULT NULL,
  `ipAddress` varchar(45) DEFAULT NULL,
  `userAgent` varchar(500) DEFAULT NULL,
  `assignedTo` int(10) unsigned DEFAULT NULL,
  `adminNotes` text,
  `resolvedAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wd_inquiries_email` (`email`),
  KEY `wd_inquiries_status` (`status`),
  KEY `wd_inquiries_priority` (`priority`),
  KEY `wd_inquiries_assigned_to` (`assignedTo`),
  KEY `wd_inquiries_created_at` (`createdAt`),
  KEY `wd_inquiries_is_deleted` (`isDeleted`),
  CONSTRAINT `wd_inquiries_ibfk_1` FOREIGN KEY (`assignedTo`) REFERENCES `wd_users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_inquiries`
--

LOCK TABLES `wd_inquiries` WRITE;
/*!40000 ALTER TABLE `wd_inquiries` DISABLE KEYS */;
/*!40000 ALTER TABLE `wd_inquiries` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_orders`
--

DROP TABLE IF EXISTS `wd_orders`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_orders` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `userId` int(10) unsigned NOT NULL,
  `localId` varchar(100) DEFAULT NULL,
  `customerName` varchar(200) NOT NULL,
  `customerPhone` varchar(20) DEFAULT NULL,
  `customerEmail` varchar(255) DEFAULT NULL,
  `orderNumber` varchar(100) NOT NULL,
  `orderDate` bigint(20) NOT NULL,
  `totalAmount` decimal(10,2) NOT NULL DEFAULT '0.00',
  `paidAmount` decimal(10,2) DEFAULT '0.00',
  `status` enum('pending','confirmed','processing','delivered','cancelled') NOT NULL DEFAULT 'pending',
  `paymentStatus` enum('pending','partial','paid') NOT NULL DEFAULT 'pending',
  `items` json DEFAULT NULL,
  `notes` text,
  `syncedAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wd_orders_user_id` (`userId`),
  KEY `wd_orders_local_id` (`localId`),
  KEY `wd_orders_order_number` (`orderNumber`),
  KEY `wd_orders_order_date` (`orderDate`),
  KEY `wd_orders_status` (`status`),
  KEY `wd_orders_is_deleted` (`isDeleted`),
  CONSTRAINT `wd_orders_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_orders`
--

LOCK TABLES `wd_orders` WRITE;
/*!40000 ALTER TABLE `wd_orders` DISABLE KEYS */;
/*!40000 ALTER TABLE `wd_orders` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_payments`
--

DROP TABLE IF EXISTS `wd_payments`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_payments` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `userId` int(10) unsigned NOT NULL,
  `localId` varchar(100) DEFAULT NULL,
  `orderId` int(10) unsigned DEFAULT NULL,
  `customerName` varchar(200) NOT NULL,
  `paymentAmount` decimal(10,2) NOT NULL,
  `paymentDate` bigint(20) NOT NULL,
  `paymentMethod` enum('cash','card','upi','bank_transfer','cheque','other') NOT NULL DEFAULT 'cash',
  `transactionId` varchar(100) DEFAULT NULL,
  `status` enum('pending','completed','failed','refunded') NOT NULL DEFAULT 'completed',
  `notes` text,
  `syncedAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wd_payments_user_id` (`userId`),
  KEY `wd_payments_order_id` (`orderId`),
  KEY `wd_payments_local_id` (`localId`),
  KEY `wd_payments_payment_date` (`paymentDate`),
  KEY `wd_payments_status` (`status`),
  KEY `wd_payments_payment_method` (`paymentMethod`),
  KEY `wd_payments_is_deleted` (`isDeleted`),
  CONSTRAINT `wd_payments_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `wd_payments_ibfk_2` FOREIGN KEY (`orderId`) REFERENCES `wd_orders` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_payments`
--

LOCK TABLES `wd_payments` WRITE;
/*!40000 ALTER TABLE `wd_payments` DISABLE KEYS */;
/*!40000 ALTER TABLE `wd_payments` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_users`
--

DROP TABLE IF EXISTS `wd_users`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_users` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `password` varchar(255) NOT NULL,
  `name` varchar(100) DEFAULT NULL,
  `role` enum('admin','staff','user') NOT NULL DEFAULT 'user',
  `isActive` tinyint(4) NOT NULL DEFAULT '1',
  `lastLoginAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`),
  KEY `wd_users_email` (`email`),
  KEY `wd_users_is_deleted` (`isDeleted`),
  KEY `wd_users_role` (`role`)
) ENGINE=InnoDB AUTO_INCREMENT=3 DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_users`
--

LOCK TABLES `wd_users` WRITE;
/*!40000 ALTER TABLE `wd_users` DISABLE KEYS */;
INSERT INTO `wd_users` VALUES (1,'admin@workdesk24.com','$2a$10$YnPfVi4/wzMbg2iyj/ST1.eXr0QKvUokVfepo7B7m/IJFfMXEEvUi','System Administrator','admin',1,NULL,1780727630,1780727630,0,NULL),(2,'nitinjbn@gmail.com','$2a$10$3efYfBZTlsoWoBdSz6JutOZon1DaAKVRYvtTL7v1IOPxejuH.RmV6','Nitin Sharma','user',1,NULL,1780730517,1780730517,0,NULL);
/*!40000 ALTER TABLE `wd_users` ENABLE KEYS */;
UNLOCK TABLES;

--
-- Table structure for table `wd_visits`
--

DROP TABLE IF EXISTS `wd_visits`;
/*!40101 SET @saved_cs_client     = @@character_set_client */;
/*!50503 SET character_set_client = utf8mb4 */;
CREATE TABLE `wd_visits` (
  `id` int(10) unsigned NOT NULL AUTO_INCREMENT,
  `userId` int(10) unsigned NOT NULL,
  `localId` varchar(100) DEFAULT NULL,
  `customerName` varchar(200) NOT NULL,
  `customerPhone` varchar(20) DEFAULT NULL,
  `customerEmail` varchar(255) DEFAULT NULL,
  `address` text,
  `latitude` decimal(10,8) DEFAULT NULL,
  `longitude` decimal(11,8) DEFAULT NULL,
  `visitType` enum('meeting','delivery','support','sales','other') NOT NULL DEFAULT 'meeting',
  `purpose` text,
  `notes` text,
  `checkInTime` bigint(20) NOT NULL,
  `checkOutTime` bigint(20) DEFAULT NULL,
  `duration` int(11) DEFAULT NULL,
  `status` enum('scheduled','in_progress','completed','cancelled') NOT NULL DEFAULT 'scheduled',
  `outcome` enum('success','failed','rescheduled','not_available') DEFAULT NULL,
  `syncedAt` bigint(20) DEFAULT NULL,
  `createdAt` bigint(20) NOT NULL,
  `updatedAt` bigint(20) NOT NULL,
  `isDeleted` tinyint(4) NOT NULL DEFAULT '0',
  `deletedAt` bigint(20) DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `wd_visits_user_id` (`userId`),
  KEY `wd_visits_local_id` (`localId`),
  KEY `wd_visits_check_in_time` (`checkInTime`),
  KEY `wd_visits_status` (`status`),
  KEY `wd_visits_visit_type` (`visitType`),
  KEY `wd_visits_is_deleted` (`isDeleted`),
  CONSTRAINT `wd_visits_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=latin1;
/*!40101 SET character_set_client = @saved_cs_client */;

--
-- Dumping data for table `wd_visits`
--

LOCK TABLES `wd_visits` WRITE;
/*!40000 ALTER TABLE `wd_visits` DISABLE KEYS */;
/*!40000 ALTER TABLE `wd_visits` ENABLE KEYS */;
UNLOCK TABLES;
/*!40103 SET TIME_ZONE=@OLD_TIME_ZONE */;

/*!40101 SET SQL_MODE=@OLD_SQL_MODE */;
/*!40014 SET FOREIGN_KEY_CHECKS=@OLD_FOREIGN_KEY_CHECKS */;
/*!40014 SET UNIQUE_CHECKS=@OLD_UNIQUE_CHECKS */;
/*!40101 SET CHARACTER_SET_CLIENT=@OLD_CHARACTER_SET_CLIENT */;
/*!40101 SET CHARACTER_SET_RESULTS=@OLD_CHARACTER_SET_RESULTS */;
/*!40101 SET COLLATION_CONNECTION=@OLD_COLLATION_CONNECTION */;
/*!40111 SET SQL_NOTES=@OLD_SQL_NOTES */;

-- Dump completed on 2026-06-17 10:48:56
