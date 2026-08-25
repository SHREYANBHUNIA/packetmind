CREATE TABLE `analysisStageEvents` (
	`id` int AUTO_INCREMENT NOT NULL,
	`analysisId` int NOT NULL,
	`stage` enum('queued','parsing','learning','detecting','complete','failed') NOT NULL,
	`progress` int NOT NULL,
	`createdAt` timestamp NOT NULL DEFAULT (now()),
	CONSTRAINT `analysisStageEvents_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
ALTER TABLE `analysisStageEvents` ADD CONSTRAINT `analysisStageEvents_analysisId_analysisRuns_id_fk` FOREIGN KEY (`analysisId`) REFERENCES `analysisRuns`(`id`) ON DELETE no action ON UPDATE no action;