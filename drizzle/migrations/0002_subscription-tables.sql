CREATE TABLE `analytics` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`user_id` text,
	`path` text,
	`user_agent` text,
	`query` text,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `app_errors` (
	`id` text PRIMARY KEY NOT NULL,
	`error` text NOT NULL,
	`query` text,
	`user_id` text,
	`timestamp` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `payment_transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`subscription_id` text,
	`reference` text NOT NULL,
	`amount` integer NOT NULL,
	`currency` text DEFAULT 'GHS' NOT NULL,
	`status` text NOT NULL,
	`plan_name` text,
	`metadata` text,
	`created_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`subscription_id`) REFERENCES `subscriptions`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `payment_transactions_reference_unique` ON `payment_transactions` (`reference`);--> statement-breakpoint
CREATE TABLE `subscription_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`currency` text DEFAULT 'GHS' NOT NULL,
	`invoices_per_month` integer,
	`max_workspaces` integer,
	`features` text,
	`is_active` integer DEFAULT true NOT NULL
);
--> statement-breakpoint
CREATE TABLE `subscriptions` (
	`id` text PRIMARY KEY NOT NULL,
	`user_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`status` text DEFAULT 'Active' NOT NULL,
	`start_date` text NOT NULL,
	`expiry_date` text,
	`auto_renew` integer DEFAULT true NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL,
	FOREIGN KEY (`user_id`) REFERENCES `users`(`uid`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `subscription_plans`(`id`) ON UPDATE no action ON DELETE no action
);
