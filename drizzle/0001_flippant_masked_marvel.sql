CREATE TABLE `chain_jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`chainId` int NOT NULL,
	`jobId` int NOT NULL,
	`position` int NOT NULL,
	`repositionCost` float,
	`repositionDurationMins` float,
	`repositionMode` enum('train','bus','tram','taxi','walk','scooter','drive','none'),
	`repositionData` json,
	CONSTRAINT `chain_jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `driver_badges` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`badgeKey` varchar(64) NOT NULL,
	`badgeName` varchar(128) NOT NULL,
	`badgeDescription` text,
	`earnedAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `driver_badges_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `job_chains` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`name` varchar(255),
	`status` enum('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
	`totalEarnings` float,
	`totalCosts` float,
	`totalNetProfit` float,
	`totalDurationMins` float,
	`totalDistanceMiles` float,
	`profitPerHour` float,
	`riskFlags` json,
	`repositionLegs` json,
	`scheduledDate` timestamp,
	`shareToken` varchar(64),
	`shareExpiresAt` timestamp,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `job_chains_id` PRIMARY KEY(`id`),
	CONSTRAINT `job_chains_shareToken_unique` UNIQUE(`shareToken`)
);
--> statement-breakpoint
CREATE TABLE `jobs` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`status` enum('planned','active','completed','cancelled') NOT NULL DEFAULT 'planned',
	`pickupPostcode` varchar(10) NOT NULL,
	`pickupAddress` text,
	`dropoffPostcode` varchar(10) NOT NULL,
	`dropoffAddress` text,
	`deliveryFee` float NOT NULL,
	`fuelDeposit` float NOT NULL DEFAULT 0,
	`brokerFeePercent` float NOT NULL DEFAULT 0,
	`brokerFeeFixed` float NOT NULL DEFAULT 0,
	`fuelReimbursed` boolean NOT NULL DEFAULT false,
	`estimatedDistanceMiles` float,
	`estimatedDurationMins` float,
	`estimatedFuelCost` float,
	`estimatedFuelPricePerLitre` float,
	`estimatedWearTear` float,
	`estimatedTimeValue` float,
	`estimatedNetProfit` float,
	`estimatedProfitPerHour` float,
	`estimatedProfitPerMile` float,
	`worthItScore` enum('green','amber','red'),
	`actualDistanceMiles` float,
	`actualDurationMins` float,
	`actualFuelCost` float,
	`actualNetProfit` float,
	`actualNotes` text,
	`scheduledPickupAt` timestamp,
	`completedAt` timestamp,
	`routeData` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `jobs_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `receipts` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`jobId` int,
	`chainId` int,
	`category` enum('train','bus','tram','taxi','fuel','parking','scooter','other') NOT NULL,
	`amount` float NOT NULL,
	`description` text,
	`receiptImageUrl` text,
	`recordedAt` timestamp NOT NULL DEFAULT (now()),
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `receipts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `user_settings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`vehicleMpg` float NOT NULL DEFAULT 35,
	`fuelType` enum('petrol','diesel') NOT NULL DEFAULT 'petrol',
	`hourlyRate` float NOT NULL DEFAULT 15,
	`wearTearPerMile` float NOT NULL DEFAULT 0.15,
	`defaultBrokerFeePercent` float NOT NULL DEFAULT 0,
	`riskBufferPercent` float NOT NULL DEFAULT 10,
	`enableTimeValue` boolean NOT NULL DEFAULT true,
	`enableWearTear` boolean NOT NULL DEFAULT true,
	`homePostcode` varchar(10),
	`alertsEnabled` boolean NOT NULL DEFAULT true,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `user_settings_id` PRIMARY KEY(`id`)
);
