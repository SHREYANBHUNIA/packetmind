CREATE TABLE `analysisRuns` (
	`id` int AUTO_INCREMENT NOT NULL,
	`captureId` int NOT NULL,
	`userId` int NOT NULL,
	`baselineCaptureId` int,
	`status` enum('uploaded','analyzing','ready','failed') NOT NULL DEFAULT 'uploaded',
	`totalPackets` int NOT NULL DEFAULT 0,
	`totalFlows` int NOT NULL DEFAULT 0,
	`totalHosts` int NOT NULL DEFAULT 0,
	`totalBytes` int NOT NULL DEFAULT 0,
	`baselineProfile` json,
	`summary` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `analysisRuns_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `captures` (
	`id` int AUTO_INCREMENT NOT NULL,
	`userId` int NOT NULL,
	`filename` varchar(255) NOT NULL,
	`networkLabel` varchar(120) NOT NULL,
	`storageKey` varchar(512) NOT NULL,
	`storageUrl` varchar(700) NOT NULL,
	`byteSize` int NOT NULL,
	`mode` enum('learn','compare') NOT NULL,
	`status` enum('uploaded','analyzing','ready','failed') NOT NULL DEFAULT 'uploaded',
	`summary` json,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`completedAt` timestamp,
	CONSTRAINT `captures_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `networkAnomalies` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisId` int NOT NULL,
	`score` int NOT NULL,
	`severity` enum('critical','elevated','watch') NOT NULL,
	`title` varchar(160) NOT NULL,
	`sourceHost` varchar(80) NOT NULL,
	`target` varchar(200) NOT NULL,
	`service` varchar(80) NOT NULL,
	`anomalyType` varchar(100) NOT NULL,
	`evidence` json NOT NULL,
	`explanation` text NOT NULL,
	`seenAt` timestamp NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `networkAnomalies_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` int AUTO_INCREMENT NOT NULL,
	`openId` varchar(64) NOT NULL,
	`name` text,
	`email` varchar(320),
	`loginMethod` varchar(64),
	`role` enum('user','admin') NOT NULL DEFAULT 'user',
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	`lastSignedIn` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_openId_unique` UNIQUE(`openId`)
);
--> statement-breakpoint
ALTER TABLE `analysisRuns` ADD CONSTRAINT `analysisRuns_captureId_captures_id_fk` FOREIGN KEY (`captureId`) REFERENCES `captures`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analysisRuns` ADD CONSTRAINT `analysisRuns_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `analysisRuns` ADD CONSTRAINT `analysisRuns_baselineCaptureId_captures_id_fk` FOREIGN KEY (`baselineCaptureId`) REFERENCES `captures`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `captures` ADD CONSTRAINT `captures_userId_users_id_fk` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `networkAnomalies` ADD CONSTRAINT `networkAnomalies_analysisId_analysisRuns_id_fk` FOREIGN KEY (`analysisId`) REFERENCES `analysisRuns`(`id`) ON DELETE no action ON UPDATE no action;