-- MySQL schema reference for the Admin host-switch / support-session implementation.
-- Derived from migrations 20261030102000 through 20261030123000 and
-- 20260728120000-add-location-address-columns-to-wd-attendance.js.
-- NOT an unconditional production deployment script. No database is selected here.
-- Use the Sequelize migrations for schema checks, legacy-token refusal and metadata.
-- Before manual execution: back up, confirm the target database and inspect SHOW CREATE TABLE.
-- Prerequisites: wd_hosts, wd_users, wd_roles, wd_permissions and wd_attendance exist.
-- Parent IDs must have matching signed BIGINT types; parent tables must use InnoDB.
-- CREATE IF NOT EXISTS does not repair an existing table or add its missing indexes.
-- Execute each ADD COLUMN / ADD INDEX only if that column / index is absent.
-- MySQL 5.7 does not support ADD COLUMN IF NOT EXISTS; this reference is not rerunnable.
-- Existing subscription DATE columns intentionally match the current migration/model.

-- ============================================================================
-- 1. Prerequisite tables: create only when absent (preserve existing definitions).
-- ============================================================================

CREATE TABLE IF NOT EXISTS `wd_user_devices` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `hostId` BIGINT NOT NULL,
  `userId` BIGINT NOT NULL,
  `deviceId` VARCHAR(255) NOT NULL,
  `deviceName` VARCHAR(100) NULL,
  `deviceModel` VARCHAR(100) NULL,
  `manufacturer` VARCHAR(100) NULL,
  `brand` VARCHAR(100) NULL,
  `device` VARCHAR(100) NULL,
  `product` VARCHAR(100) NULL,
  `hardware` VARCHAR(255) NULL,
  `osVersion` VARCHAR(50) NULL,
  `sdkInt` SMALLINT NULL,
  `appVersion` VARCHAR(20) NULL,
  `storageTotalBytes` BIGINT NULL,
  `storageAvailableBytes` BIGINT NULL,
  `storageUsedBytes` BIGINT NULL,
  `isActive` TINYINT NOT NULL DEFAULT 1,
  `sessionId` VARCHAR(100) NULL,
  `fcmToken` VARCHAR(255) NULL,
  `createdAt` BIGINT NULL,
  `updatedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_user_devices_host` (`hostId`),
  KEY `idx_user_devices_user` (`userId`),
  UNIQUE KEY `uk_user_devices_host_user_device` (`hostId`, `userId`, `deviceId`),
  KEY `idx_user_devices_device` (`deviceId`),
  FOREIGN KEY (`hostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_user_settings` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` BIGINT NOT NULL,
  `settingName` VARCHAR(255) NOT NULL,
  `settingValue` TEXT NULL,
  `isEnabled` TINYINT NOT NULL DEFAULT 1,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NULL,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_user_settings_user` (`userId`),
  KEY `idx_user_settings_name` (`settingName`),
  KEY `idx_user_settings_enabled` (`isEnabled`),
  KEY `idx_user_settings_deleted` (`isDeleted`),
  FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_user_permissions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `hostId` BIGINT NOT NULL,
  `userId` BIGINT NOT NULL,
  `permissionId` BIGINT NOT NULL,
  `isEnabled` TINYINT NOT NULL DEFAULT 1,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NULL,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_user_permissions_host` (`hostId`),
  KEY `idx_user_permissions_user` (`userId`),
  KEY `idx_user_permissions_permission` (`permissionId`),
  KEY `idx_user_permissions_scope` (`hostId`, `userId`, `permissionId`),
  KEY `idx_user_permissions_enabled` (`isEnabled`),
  KEY `idx_user_permissions_deleted` (`isDeleted`),
  FOREIGN KEY (`hostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`permissionId`) REFERENCES `wd_permissions` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_attendance_sites` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `hostId` BIGINT NOT NULL,
  `siteName` VARCHAR(100) NOT NULL,
  `latitude` DECIMAL(10,8) NOT NULL,
  `longitude` DECIMAL(11,8) NOT NULL,
  `radiusMeters` INTEGER NOT NULL,
  `isEnabled` TINYINT NOT NULL DEFAULT 1,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NULL,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_attendance_sites_host` (`hostId`),
  FOREIGN KEY (`hostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_user_attendance_sites` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `userId` BIGINT NOT NULL,
  `attendanceSiteId` BIGINT NOT NULL,
  `isEnabled` TINYINT NOT NULL DEFAULT 1,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NULL,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_user_attendance_sites_user` (`userId`),
  KEY `idx_user_attendance_sites_site` (`attendanceSiteId`),
  FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`attendanceSiteId`) REFERENCES `wd_attendance_sites` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_host_settings` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `hostId` BIGINT NOT NULL,
  `settingName` VARCHAR(255) NOT NULL,
  `settingValue` TEXT NULL,
  `isEnabled` TINYINT NOT NULL DEFAULT 1,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NULL,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_host_settings_host` (`hostId`),
  KEY `idx_host_settings_name` (`settingName`),
  KEY `idx_host_settings_enabled` (`isEnabled`),
  KEY `idx_host_settings_deleted` (`isDeleted`),
  FOREIGN KEY (`hostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_subscription_cycles` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `cycleCode` VARCHAR(20) NOT NULL,
  `cycleName` VARCHAR(50) NOT NULL,
  `validityInMonths` SMALLINT NOT NULL,
  `perUserMonthlyPrice` DECIMAL(10,2) NOT NULL,
  `perUserSetupPrice` DECIMAL(10,2) NOT NULL,
  `minimumUsers` SMALLINT NOT NULL,
  `isPopular` TINYINT NOT NULL DEFAULT 0,
  `remarks` VARCHAR(255) NULL,
  `sortOrder` TINYINT NOT NULL DEFAULT 0,
  `isEnabled` TINYINT NOT NULL DEFAULT 1,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NULL,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_subscription_cycles_code` (`cycleCode`),
  KEY `idx_subscription_cycles_name` (`cycleName`),
  KEY `idx_subscription_cycles_validity` (`validityInMonths`),
  KEY `idx_subscription_cycles_monthly_price` (`perUserMonthlyPrice`),
  KEY `idx_subscription_cycles_setup_price` (`perUserSetupPrice`),
  KEY `idx_subscription_cycles_minimum_users` (`minimumUsers`),
  KEY `idx_subscription_cycles_popular` (`isPopular`),
  KEY `idx_subscription_cycles_enabled` (`isEnabled`),
  KEY `idx_subscription_cycles_deleted` (`isDeleted`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_host_subscriptions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `hostId` BIGINT NOT NULL,
  `subscriptionCycleId` BIGINT NOT NULL,
  `licensedUserCount` INTEGER NOT NULL,
  `validityInMonths` SMALLINT NOT NULL,
  `perUserMonthlyPrice` DECIMAL(10,2) NOT NULL,
  `perUserSetupPrice` DECIMAL(10,2) NOT NULL,
  `discountType` ENUM('PERCENTAGE','FIXED') NULL,
  `discountValue` DECIMAL(10,2) NULL,
  `grossAmount` DECIMAL(10,2) NOT NULL,
  `discountAmount` DECIMAL(10,2) NOT NULL,
  `netAmount` DECIMAL(10,2) NOT NULL,
  `planStartDate` DATE NOT NULL,
  `planEndDate` DATE NOT NULL,
  `paymentStatus` ENUM('FREE','PENDING','PAID') NOT NULL,
  `paymentReference` VARCHAR(255) NULL,
  `remarks` VARCHAR(255) NULL,
  `isEnabled` TINYINT NOT NULL DEFAULT 1,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NULL,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_host_subscriptions_host` (`hostId`),
  KEY `idx_host_subscriptions_cycle` (`subscriptionCycleId`),
  KEY `idx_host_subscriptions_licensed_users` (`licensedUserCount`),
  KEY `idx_host_subscriptions_discount_type` (`discountType`),
  KEY `idx_host_subscriptions_discount_value` (`discountValue`),
  KEY `idx_host_subscriptions_enabled` (`isEnabled`),
  KEY `idx_host_subscriptions_deleted` (`isDeleted`),
  FOREIGN KEY (`hostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`subscriptionCycleId`) REFERENCES `wd_subscription_cycles` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ============================================================================
-- 2. Refresh tokens and history.
-- STOP if wd_user_refresh_tokens is absent and wd_admin_refresh_tokens has rows.
-- That case requires reviewed legacy conversion, NOT an empty replacement table.
-- Do not drop, truncate or rename wd_admin_refresh_tokens with this reference.
-- The ownership table is migration bookkeeping. Manual CREATE does not claim ownership;
-- only the migration records ownership when it actually creates wd_user_refresh_tokens.
-- ============================================================================

CREATE TABLE IF NOT EXISTS `wd_migration_object_ownership` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `migrationName` VARCHAR(128) NOT NULL,
  `objectName` VARCHAR(128) NOT NULL,
  `createdAt` BIGINT NOT NULL,
  UNIQUE KEY `uk_migration_object_ownership` (`migrationName`, `objectName`)
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_user_refresh_tokens` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `hostId` BIGINT NOT NULL,
  `userId` BIGINT NOT NULL,
  `tokenHash` VARCHAR(128) NOT NULL,
  `tokenFamily` VARCHAR(64) NOT NULL,
  `deviceType` ENUM('WEB','ANDROID','IOS') NOT NULL,
  `deviceId` VARCHAR(255) NOT NULL,
  `deviceName` VARCHAR(255) NULL,
  `appVersion` VARCHAR(20) NULL,
  `expiresAt` BIGINT NOT NULL,
  `lastUsedAt` BIGINT NULL,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NOT NULL,
  `replacedByTokenHash` VARCHAR(128) NULL,
  `isRevoked` TINYINT NOT NULL DEFAULT 0,
  `revokedReason` VARCHAR(50) NULL,
  `revokedAt` BIGINT NULL,
  UNIQUE KEY `uk_host_user_device` (`hostId`, `userId`, `deviceId`),
  UNIQUE KEY `uk_token_hash` (`tokenHash`),
  KEY `idx_hostId` (`hostId`),
  KEY `idx_userId` (`userId`),
  KEY `idx_tokenFamily` (`tokenFamily`),
  KEY `idx_expiresAt` (`expiresAt`),
  KEY `idx_isRevoked` (`isRevoked`)
) ENGINE=InnoDB;

-- Required for either newly created or existing refresh-token tables, if missing.
ALTER TABLE `wd_user_refresh_tokens` ADD COLUMN `switchSessionId` VARCHAR(36) NULL DEFAULT NULL;
ALTER TABLE `wd_user_refresh_tokens` ADD COLUMN `contextVersion` INTEGER NULL DEFAULT NULL;
ALTER TABLE `wd_user_refresh_tokens` ADD INDEX `idx_refresh_tokens_switch_session` (`switchSessionId`);

CREATE TABLE IF NOT EXISTS `wd_user_refresh_token_history` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `refreshTokenId` BIGINT NOT NULL,
  `hostId` BIGINT NOT NULL,
  `userId` BIGINT NOT NULL,
  `tokenHash` VARCHAR(128) NOT NULL,
  `tokenFamily` VARCHAR(64) NOT NULL,
  `deviceType` ENUM('WEB','ANDROID','IOS') NOT NULL,
  `deviceId` VARCHAR(255) NOT NULL,
  `expiresAt` BIGINT NOT NULL,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NOT NULL,
  `revokedAt` BIGINT NOT NULL,
  `replacedByTokenHash` VARCHAR(128) NULL,
  `revokedReason` VARCHAR(50) NOT NULL,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  `switchSessionId` VARCHAR(36) NULL DEFAULT NULL,
  `contextVersion` INTEGER NULL DEFAULT NULL,
  UNIQUE KEY `uk_refresh_history_token_hash` (`tokenHash`),
  KEY `idx_refresh_history_token_id` (`refreshTokenId`),
  KEY `idx_refresh_history_user_family` (`userId`, `tokenFamily`),
  KEY `idx_refresh_history_switch_session` (`switchSessionId`)
) ENGINE=InnoDB;

-- ONLY for an existing history table missing these columns/indexes. They are already
-- included in CREATE above; leave these commented after creating a new history table.
-- ALTER TABLE `wd_user_refresh_token_history` ADD COLUMN `switchSessionId` VARCHAR(36) NULL DEFAULT NULL;
-- ALTER TABLE `wd_user_refresh_token_history` ADD COLUMN `contextVersion` INTEGER NULL DEFAULT NULL;
-- ALTER TABLE `wd_user_refresh_token_history` ADD UNIQUE INDEX `uk_refresh_history_token_hash` (`tokenHash`);
-- ALTER TABLE `wd_user_refresh_token_history` ADD INDEX `idx_refresh_history_token_id` (`refreshTokenId`);
-- ALTER TABLE `wd_user_refresh_token_history` ADD INDEX `idx_refresh_history_user_family` (`userId`, `tokenFamily`);
-- ALTER TABLE `wd_user_refresh_token_history` ADD INDEX `idx_refresh_history_switch_session` (`switchSessionId`);

-- ============================================================================
-- 3. New support-session tables (sessions must precede audits for the foreign key).
-- ============================================================================

CREATE TABLE IF NOT EXISTS `wd_admin_switch_sessions` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `switchSessionId` VARCHAR(36) NOT NULL,
  `userId` BIGINT NOT NULL,
  `originalHostId` BIGINT NOT NULL,
  `sourceTokenFamily` VARCHAR(64) NOT NULL,
  `currentHostId` BIGINT NOT NULL,
  `tokenFamily` VARCHAR(64) NOT NULL,
  `deviceId` VARCHAR(255) NOT NULL,
  `currentRefreshTokenId` BIGINT NULL,
  `contextVersion` INTEGER NOT NULL DEFAULT 1,
  `isActive` TINYINT NOT NULL DEFAULT 1,
  `startedAt` BIGINT NOT NULL,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NOT NULL,
  `endedAt` BIGINT NULL DEFAULT NULL,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  UNIQUE KEY `uk_admin_switch_session_id` (`switchSessionId`),
  KEY `idx_admin_switch_user_active` (`userId`, `isActive`),
  KEY `idx_admin_switch_token_family` (`tokenFamily`),
  KEY `idx_admin_switch_source_family_active` (`userId`, `sourceTokenFamily`, `isActive`),
  KEY `idx_admin_switch_current_host_active` (`currentHostId`, `isActive`),
  FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`originalHostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`currentHostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- ONLY for a pre-existing switch-session table without sourceTokenFamily.
-- The migration intentionally adds it nullable for legacy rows; do not invent a backfill.
-- ALTER TABLE `wd_admin_switch_sessions` ADD COLUMN `sourceTokenFamily` VARCHAR(64) NULL DEFAULT NULL;
-- ALTER TABLE `wd_admin_switch_sessions` ADD INDEX `idx_admin_switch_source_family_active` (`userId`, `sourceTokenFamily`, `isActive`);

CREATE TABLE IF NOT EXISTS `wd_admin_host_switch_audits` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `switchSessionId` VARCHAR(36) NOT NULL,
  `originalUserId` BIGINT NOT NULL,
  `originalHostId` BIGINT NOT NULL,
  `previousHostId` BIGINT NULL,
  `newHostId` BIGINT NULL,
  `eventType` ENUM('SWITCH','SESSION_TERMINATED') NOT NULL,
  `contextVersion` INTEGER NOT NULL,
  `requestIp` VARCHAR(45) NULL,
  `userAgent` VARCHAR(512) NULL,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NOT NULL,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  KEY `idx_admin_switch_audit_session_time` (`switchSessionId`, `createdAt`),
  KEY `idx_admin_switch_audit_user_time` (`originalUserId`, `createdAt`),
  KEY `idx_admin_switch_audit_host_time` (`newHostId`, `createdAt`),
  FOREIGN KEY (`switchSessionId`) REFERENCES `wd_admin_switch_sessions` (`switchSessionId`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`originalUserId`) REFERENCES `wd_users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`originalHostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`previousHostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT,
  FOREIGN KEY (`newHostId`) REFERENCES `wd_hosts` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

CREATE TABLE IF NOT EXISTS `wd_admin_switch_handoffs` (
  `id` BIGINT NOT NULL AUTO_INCREMENT PRIMARY KEY,
  `tokenHash` VARCHAR(64) NOT NULL,
  `userId` BIGINT NOT NULL,
  `tokenFamily` VARCHAR(64) NOT NULL,
  `expiresAt` BIGINT NOT NULL,
  `consumedAt` BIGINT NULL DEFAULT NULL,
  `createdAt` BIGINT NOT NULL,
  `updatedAt` BIGINT NOT NULL,
  `isDeleted` TINYINT NOT NULL DEFAULT 0,
  `deletedAt` BIGINT NULL DEFAULT NULL,
  UNIQUE KEY `uk_admin_switch_handoff_hash` (`tokenHash`),
  KEY `idx_admin_switch_handoff_user_family_expiry` (`userId`, `tokenFamily`, `expiresAt`),
  FOREIGN KEY (`userId`) REFERENCES `wd_users` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT
) ENGINE=InnoDB;

-- Execute each CREATE TRIGGER only if that named trigger is absent.
-- Each trigger has one statement, so no DELIMITER change is needed.
CREATE TRIGGER `trg_admin_host_switch_audits_no_update`
BEFORE UPDATE ON `wd_admin_host_switch_audits`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Host switch audit is append-only';

CREATE TRIGGER `trg_admin_host_switch_audits_no_delete`
BEFORE DELETE ON `wd_admin_host_switch_audits`
FOR EACH ROW SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Host switch audit is append-only';

-- ============================================================================
-- 4. Existing host columns: ADD only missing columns, then backfill / enforce subDomain.
-- ============================================================================

ALTER TABLE `wd_hosts` ADD COLUMN `subDomain` VARCHAR(20) NULL;
ALTER TABLE `wd_hosts` ADD COLUMN `callingCode` VARCHAR(6) NULL;
ALTER TABLE `wd_hosts` ADD COLUMN `landmark` VARCHAR(50) NULL;
ALTER TABLE `wd_hosts` ADD COLUMN `countryName` VARCHAR(50) NULL;
ALTER TABLE `wd_hosts` ADD COLUMN `countryIsoCode` CHAR(2) NULL;
ALTER TABLE `wd_hosts` ADD COLUMN `stateName` VARCHAR(50) NULL;
ALTER TABLE `wd_hosts` ADD COLUMN `stateIsoCode` CHAR(2) NULL;
ALTER TABLE `wd_hosts` ADD COLUMN `district` VARCHAR(50) NULL;
ALTER TABLE `wd_hosts` ADD COLUMN `pinCode` VARCHAR(20) NULL;

-- Optional legacy address backfills: execute only when BOTH named columns exist.
-- UPDATE `wd_hosts` SET `stateName` = `state` WHERE `stateName` IS NULL AND `state` IS NOT NULL;
-- UPDATE `wd_hosts` SET `countryName` = `country` WHERE `countryName` IS NULL AND `country` IS NOT NULL;
-- UPDATE `wd_hosts` SET `pinCode` = `postalCode` WHERE `pinCode` IS NULL AND `postalCode` IS NOT NULL;

UPDATE `wd_hosts` SET `subDomain` = CONCAT('legacy-', `id`)
WHERE `subDomain` IS NULL OR TRIM(`subDomain`) = '';
-- Verify all subDomain values fit VARCHAR(20) and are unique before enforcing.
ALTER TABLE `wd_hosts` MODIFY COLUMN `subDomain` VARCHAR(20) NOT NULL;
-- Skip if ANY existing unique index already covers subDomain as in the migration.
ALTER TABLE `wd_hosts` ADD UNIQUE INDEX `uk_hosts_sub_domain` (`subDomain`);

-- ============================================================================
-- 5. Existing user columns: execute only the additions absent from wd_users.
-- ============================================================================

ALTER TABLE `wd_users` ADD COLUMN `designationId` BIGINT NULL;
ALTER TABLE `wd_users` ADD COLUMN `employeeCode` VARCHAR(20) NULL;
ALTER TABLE `wd_users` ADD COLUMN `enteredMobileNumber` VARCHAR(20) NULL;
ALTER TABLE `wd_users` ADD COLUMN `callingCode` VARCHAR(6) NULL;
ALTER TABLE `wd_users` ADD COLUMN `mobileVerified` TINYINT NOT NULL DEFAULT 0;
ALTER TABLE `wd_users` ADD COLUMN `mobileVerifiedAt` BIGINT NULL DEFAULT NULL;
ALTER TABLE `wd_users` ADD COLUMN `dateOfBirth` BIGINT NULL;
ALTER TABLE `wd_users` ADD COLUMN `gender` ENUM('MALE','FEMALE','OTHER','PREFER_NOT_TO_SAY') NULL;
ALTER TABLE `wd_users` ADD COLUMN `accountStatus` ENUM('ACTIVE','INACTIVE') NOT NULL DEFAULT 'ACTIVE';
ALTER TABLE `wd_users` ADD COLUMN `accountStatusUpdatedAt` BIGINT NULL DEFAULT NULL;
ALTER TABLE `wd_users` ADD COLUMN `addressLine1` VARCHAR(50) NULL;
ALTER TABLE `wd_users` ADD COLUMN `addressLine2` VARCHAR(50) NULL;
ALTER TABLE `wd_users` ADD COLUMN `landmark` VARCHAR(50) NULL;
ALTER TABLE `wd_users` ADD COLUMN `countryName` VARCHAR(50) NULL;
ALTER TABLE `wd_users` ADD COLUMN `countryIsoCode` CHAR(2) NULL;
ALTER TABLE `wd_users` ADD COLUMN `stateName` VARCHAR(50) NULL;
ALTER TABLE `wd_users` ADD COLUMN `stateIsoCode` CHAR(2) NULL;
ALTER TABLE `wd_users` ADD COLUMN `city` VARCHAR(50) NULL;
ALTER TABLE `wd_users` ADD COLUMN `district` VARCHAR(50) NULL;
ALTER TABLE `wd_users` ADD COLUMN `pinCode` VARCHAR(20) NULL;
ALTER TABLE `wd_users` ADD COLUMN `timezone` VARCHAR(50) NULL;
ALTER TABLE `wd_users` ADD COLUMN `holidayCalendarId` BIGINT NULL;
ALTER TABLE `wd_users` ADD COLUMN `leavePolicyId` BIGINT NULL;
ALTER TABLE `wd_users` ADD COLUMN `isFieldAppUser` TINYINT NOT NULL DEFAULT 0;
ALTER TABLE `wd_users` ADD COLUMN `isAdminUser` TINYINT NOT NULL DEFAULT 0;
ALTER TABLE `wd_users` ADD COLUMN `isSuperAdmin` TINYINT NOT NULL DEFAULT 0;

-- Execute ONLY if accountStatus was newly added AND legacy isActive exists.
-- UPDATE `wd_users` SET `accountStatus` = 'INACTIVE' WHERE `isActive` = 0;

-- Execute ONLY if accountStatusUpdatedAt was newly added.
-- UPDATE `wd_users` SET `accountStatusUpdatedAt` = COALESCE(`updatedAt`, `createdAt`, UNIX_TIMESTAMP())
-- WHERE `accountStatusUpdatedAt` IS NULL;

-- Execute ONLY if isAdminUser was newly added. Preserve existing authentication flags.
-- UPDATE `wd_users` AS u
-- INNER JOIN `wd_roles` AS r ON r.id = u.roleId AND r.hostId = u.hostId
-- SET u.isAdminUser = 1
-- WHERE r.roleCode = 'ADMIN' AND r.isEnabled = 1 AND r.isDeleted = 0 AND u.isDeleted = 0;

-- ============================================================================
-- 6. Attendance location columns: execute only if absent.
-- ============================================================================

ALTER TABLE `wd_attendance` ADD COLUMN `attendanceLocation` VARCHAR(255) NULL;
ALTER TABLE `wd_attendance` ADD COLUMN `dayoverLocation` VARCHAR(255) NULL;