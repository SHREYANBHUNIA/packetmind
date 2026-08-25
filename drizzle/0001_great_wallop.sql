ALTER TABLE `analysisRuns` ADD `stage` enum('queued','parsing','learning','detecting','complete','failed') DEFAULT 'queued' NOT NULL;--> statement-breakpoint
ALTER TABLE `analysisRuns` ADD `progress` int DEFAULT 0 NOT NULL;--> statement-breakpoint
ALTER TABLE `analysisRuns` ADD `failureReason` text;