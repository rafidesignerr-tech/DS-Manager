CREATE TABLE `token_tracking` (
	`token_id` text PRIMARY KEY NOT NULL,
	`design_status` text DEFAULT 'todo' NOT NULL,
	`web_status` text DEFAULT 'todo' NOT NULL,
	`mobile_status` text DEFAULT 'todo' NOT NULL,
	`assignee_id` text,
	`notes` text DEFAULT '' NOT NULL,
	`docs_url` text,
	`updated_by_id` text,
	`updated_at` integer DEFAULT (unixepoch() * 1000) NOT NULL,
	FOREIGN KEY (`assignee_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null,
	FOREIGN KEY (`updated_by_id`) REFERENCES `user`(`id`) ON UPDATE no action ON DELETE set null
);
--> statement-breakpoint
CREATE INDEX `token_tracking_assignee_idx` ON `token_tracking` (`assignee_id`);