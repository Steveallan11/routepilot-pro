-- Migration: Add subscription fields, brokers, vehicle condition reports, lifts, notifications, usage counters

-- Add subscription fields to users
ALTER TABLE `users`
  ADD COLUMN `subscriptionTier` ENUM('free','pro') NOT NULL DEFAULT 'free',
  ADD COLUMN `stripeCustomerId` VARCHAR(64),
  ADD COLUMN `stripeSubscriptionId` VARCHAR(64),
  ADD COLUMN `subscriptionExpiresAt` TIMESTAMP NULL;

-- Add notification preferences to user_settings
ALTER TABLE `user_settings`
  ADD COLUMN `notifyBadgeUnlocks` BOOLEAN NOT NULL DEFAULT TRUE,
  ADD COLUMN `notifyWeeklyDigest` BOOLEAN NOT NULL DEFAULT TRUE;

-- Add brokerId to jobs
ALTER TABLE `jobs`
  ADD COLUMN `brokerId` INT;

-- Create brokers table
CREATE TABLE IF NOT EXISTS `brokers` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `name` VARCHAR(100) NOT NULL,
  `feePercent` DECIMAL(5,2) DEFAULT 0,
  `feeFixed` DECIMAL(8,2) DEFAULT 0,
  `notes` TEXT,
  `website` VARCHAR(255),
  `phone` VARCHAR(20),
  `rating` INT,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- Create vehicle_condition_reports table
CREATE TABLE IF NOT EXISTS `vehicle_condition_reports` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `jobId` INT,
  `type` ENUM('pickup','dropoff') NOT NULL,
  `vehicleReg` VARCHAR(20),
  `vehicleMake` VARCHAR(50),
  `vehicleModel` VARCHAR(50),
  `vehicleColour` VARCHAR(30),
  `photoUrls` JSON,
  `videoUrl` TEXT,
  `damageNotes` TEXT,
  `hasDamage` BOOLEAN NOT NULL DEFAULT FALSE,
  `damageLocations` JSON,
  `locationPostcode` VARCHAR(10),
  `locationLat` DECIMAL(10,7),
  `locationLng` DECIMAL(10,7),
  `shareToken` VARCHAR(64),
  `shareExpiresAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- Create lifts table
CREATE TABLE IF NOT EXISTS `lifts` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `fromPostcode` VARCHAR(10) NOT NULL,
  `fromLabel` VARCHAR(100),
  `toPostcode` VARCHAR(10) NOT NULL,
  `toLabel` VARCHAR(100),
  `departureTime` TIMESTAMP NOT NULL,
  `seats` INT NOT NULL DEFAULT 1,
  `pricePerSeat` DECIMAL(8,2) NOT NULL,
  `status` ENUM('active','full','cancelled','completed') NOT NULL DEFAULT 'active',
  `notes` TEXT,
  `stripePaymentIntentId` VARCHAR(64),
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- Create lift_requests table
CREATE TABLE IF NOT EXISTS `lift_requests` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `liftId` INT NOT NULL,
  `requesterId` INT NOT NULL,
  `status` ENUM('pending','accepted','rejected','cancelled','completed') NOT NULL DEFAULT 'pending',
  `message` TEXT,
  `seatsRequested` INT NOT NULL DEFAULT 1,
  `totalPrice` DECIMAL(8,2),
  `stripePaymentIntentId` VARCHAR(64),
  `paidAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW(),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);

-- Create notifications table
CREATE TABLE IF NOT EXISTS `notifications` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL,
  `type` ENUM('badge_unlock','weekly_digest','lift_request','lift_accepted','lift_rejected','system') NOT NULL,
  `title` VARCHAR(200) NOT NULL,
  `body` TEXT,
  `data` JSON,
  `readAt` TIMESTAMP NULL,
  `createdAt` TIMESTAMP NOT NULL DEFAULT NOW()
);

-- Create usage_counters table
CREATE TABLE IF NOT EXISTS `usage_counters` (
  `id` INT AUTO_INCREMENT PRIMARY KEY,
  `userId` INT NOT NULL UNIQUE,
  `monthKey` VARCHAR(7) NOT NULL DEFAULT '',
  `aiScansThisMonth` INT NOT NULL DEFAULT 0,
  `routeSearchesToday` INT NOT NULL DEFAULT 0,
  `routeSearchDate` VARCHAR(10),
  `updatedAt` TIMESTAMP NOT NULL DEFAULT NOW() ON UPDATE NOW()
);
