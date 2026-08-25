CREATE TABLE `workerSettings` (
	`id` int AUTO_INCREMENT NOT NULL,
	`workerName` varchar(80) NOT NULL,
	`scheduleCronTaskUid` varchar(65) NOT NULL,
	`enabled` int NOT NULL DEFAULT 1,
	`updatedAt` timestamp NOT NULL DEFAULT (now()) ON UPDATE CURRENT_TIMESTAMP,
	CONSTRAINT `workerSettings_id` PRIMARY KEY(`id`),
	CONSTRAINT `workerSettings_workerName_unique` UNIQUE(`workerName`)
);
