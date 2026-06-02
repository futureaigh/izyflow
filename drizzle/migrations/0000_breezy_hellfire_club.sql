CREATE TABLE `accounts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`balance` real NOT NULL,
	`currency` text NOT NULL,
	`is_default` integer,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `allocation_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`percentage` real NOT NULL,
	`target_account_id` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `catalog_items` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`description` text NOT NULL,
	`price` real NOT NULL,
	`currency` text NOT NULL,
	`category` text NOT NULL,
	`type` text NOT NULL,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `cms_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`logo_url` text,
	`sidebar_logo_url` text,
	`hero_image_url` text,
	`font_family` text,
	`brand_color` text,
	`hero_heading` text,
	`hero_subtext` text,
	`features_heading` text,
	`features_subtext` text,
	`intelligence_heading` text,
	`intelligence_subtext` text,
	`automation_heading` text,
	`automation_subtext` text,
	`growth_heading` text,
	`growth_subtext` text,
	`data_freedom_heading` text,
	`data_freedom_subtext` text,
	`simplicity_heading` text,
	`simplicity_subtext` text,
	`cta_heading` text,
	`cta_subtext` text,
	`footer_subtext` text,
	`copyright_text` text,
	`faqs` text,
	`services` text,
	`hide_brand_name` integer,
	`custom_domain` text,
	`txt_record` text,
	`hero_badge_text` text,
	`site_name` text,
	`favicon_url` text
);
--> statement-breakpoint
CREATE TABLE `contacts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`email` text,
	`phone` text,
	`type` text,
	`notes` text,
	`frequency` integer,
	`last_used` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `invoices` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_name` text NOT NULL,
	`client_business_name` text NOT NULL,
	`client_email` text,
	`client_phone` text,
	`introduction` text,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`status` text NOT NULL,
	`created_at` text NOT NULL,
	`due_date` text,
	`items` text NOT NULL,
	`paid_amount` real,
	`updated_at` text,
	`payment_terms` text,
	`discount_type` text,
	`discount_value` real,
	`subtotal` real,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `pricing_calculations` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`client_name` text NOT NULL,
	`pricing_type` text NOT NULL,
	`inputs` text NOT NULL,
	`total_price` real NOT NULL,
	`created_at` text NOT NULL,
	`notes` text
);
--> statement-breakpoint
CREATE TABLE `staff` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`name` text NOT NULL,
	`role` text NOT NULL,
	`email` text,
	`phone` text,
	`bank_name` text,
	`account_number` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `staff_receipts` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`staff_id` text,
	`recipient_name` text NOT NULL,
	`recipient_role` text,
	`recipient_email` text,
	`title` text NOT NULL,
	`date` text NOT NULL,
	`payment_method` text NOT NULL,
	`items` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`notes` text,
	`reference_number` text,
	`created_at` text NOT NULL
);
--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`workspace_id` text NOT NULL,
	`type` text NOT NULL,
	`amount` real NOT NULL,
	`currency` text NOT NULL,
	`category` text NOT NULL,
	`date` text NOT NULL,
	`time` text,
	`description` text NOT NULL,
	`payee_payer` text,
	`is_loan` integer,
	`loan_status` text,
	`account_id` text,
	`affects_cash` integer,
	`affects_profit` integer,
	`affects_investment` integer,
	`affects_debt` integer,
	`invoice_id` text,
	`created_at` text,
	`updated_at` text
);
--> statement-breakpoint
CREATE TABLE `users` (
	`uid` text PRIMARY KEY NOT NULL,
	`email` text NOT NULL,
	`display_name` text NOT NULL,
	`photo_url` text,
	`created_at` text NOT NULL,
	`last_seen` text,
	`role` text,
	`subscription` text,
	`preferences` text
);
--> statement-breakpoint
CREATE TABLE `workspaces` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`owner_id` text NOT NULL,
	`currency` text NOT NULL,
	`logo_url` text,
	`description` text,
	`income_categories` text,
	`expense_categories` text,
	`investment_categories` text,
	`sales_target` real,
	`retainer_target` real,
	`business_address` text,
	`business_phone` text,
	`business_email` text,
	`tax_id` text,
	`bank_name` text,
	`bank_branch` text,
	`account_number` text,
	`mobile_money_provider` text,
	`mobile_money_number` text,
	`online_payment_url` text,
	`brand_color` text,
	`created_at` text NOT NULL,
	`updated_at` text NOT NULL
);
