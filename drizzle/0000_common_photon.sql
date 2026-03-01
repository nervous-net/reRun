CREATE TABLE `alert_configs` (
	`id` text PRIMARY KEY NOT NULL,
	`type` text NOT NULL,
	`template` text NOT NULL,
	`enabled` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `copies` (
	`id` text PRIMARY KEY NOT NULL,
	`title_id` text NOT NULL,
	`barcode` text NOT NULL,
	`format` text NOT NULL,
	`condition` text DEFAULT 'good',
	`status` text DEFAULT 'in',
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE UNIQUE INDEX `copies_barcode_unique` ON `copies` (`barcode`);--> statement-breakpoint
CREATE INDEX `copies_title_id_idx` ON `copies` (`title_id`);--> statement-breakpoint
CREATE INDEX `copies_status_idx` ON `copies` (`status`);--> statement-breakpoint
CREATE TABLE `customer_prepaid` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`plan_id` text NOT NULL,
	`remaining_credit` integer NOT NULL,
	`remaining_rentals` integer NOT NULL,
	`expires_at` text NOT NULL,
	`purchased_at` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`plan_id`) REFERENCES `prepaid_plans`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE TABLE `customers` (
	`id` text PRIMARY KEY NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`email` text,
	`phone` text,
	`address` text,
	`birthday` text,
	`notes` text,
	`balance` integer DEFAULT 0,
	`member_barcode` text NOT NULL,
	`active` integer DEFAULT 1,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `customers_member_barcode_unique` ON `customers` (`member_barcode`);--> statement-breakpoint
CREATE TABLE `family_members` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`first_name` text NOT NULL,
	`last_name` text NOT NULL,
	`relationship` text,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `family_members_customer_id_idx` ON `family_members` (`customer_id`);--> statement-breakpoint
CREATE TABLE `prepaid_plans` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`price` integer NOT NULL,
	`credit_value` integer NOT NULL,
	`rental_count` integer NOT NULL,
	`duration_days` integer NOT NULL,
	`active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `pricing_rules` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`rate` integer NOT NULL,
	`duration_days` integer NOT NULL,
	`late_fee_per_day` integer DEFAULT 0,
	`active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `products` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`sku` text NOT NULL,
	`price` integer NOT NULL,
	`cost` integer NOT NULL,
	`tax_rate` integer DEFAULT 0,
	`stock_qty` integer DEFAULT 0,
	`reorder_level` integer DEFAULT 0,
	`category` text,
	`active` integer DEFAULT 1,
	`created_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE UNIQUE INDEX `products_sku_unique` ON `products` (`sku`);--> statement-breakpoint
CREATE TABLE `promotions` (
	`id` text PRIMARY KEY NOT NULL,
	`name` text NOT NULL,
	`type` text NOT NULL,
	`rules` text,
	`start_date` text,
	`end_date` text,
	`active` integer DEFAULT 1
);
--> statement-breakpoint
CREATE TABLE `rentals` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`copy_id` text NOT NULL,
	`transaction_id` text,
	`pricing_rule_id` text,
	`checked_out_at` text NOT NULL,
	`due_at` text NOT NULL,
	`returned_at` text,
	`late_fee` integer DEFAULT 0,
	`late_fee_status` text,
	`status` text NOT NULL,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`copy_id`) REFERENCES `copies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`pricing_rule_id`) REFERENCES `pricing_rules`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `rentals_customer_id_idx` ON `rentals` (`customer_id`);--> statement-breakpoint
CREATE INDEX `rentals_copy_id_idx` ON `rentals` (`copy_id`);--> statement-breakpoint
CREATE INDEX `rentals_status_idx` ON `rentals` (`status`);--> statement-breakpoint
CREATE TABLE `reservations` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`title_id` text NOT NULL,
	`reserved_at` text NOT NULL,
	`expires_at` text NOT NULL,
	`fulfilled` integer DEFAULT 0,
	`notified` integer DEFAULT 0,
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`title_id`) REFERENCES `titles`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `reservations_customer_id_idx` ON `reservations` (`customer_id`);--> statement-breakpoint
CREATE INDEX `reservations_title_id_idx` ON `reservations` (`title_id`);--> statement-breakpoint
CREATE TABLE `store_settings` (
	`key` text PRIMARY KEY NOT NULL,
	`value` text
);
--> statement-breakpoint
CREATE TABLE `titles` (
	`id` text PRIMARY KEY NOT NULL,
	`tmdb_id` integer,
	`name` text NOT NULL,
	`year` integer NOT NULL,
	`genre` text,
	`runtime_minutes` integer,
	`synopsis` text,
	`rating` text,
	`cast_list` text,
	`director` text,
	`cover_url` text,
	`media_type` text DEFAULT 'movie',
	`number_of_seasons` integer,
	`created_at` text DEFAULT (datetime('now')),
	`updated_at` text DEFAULT (datetime('now'))
);
--> statement-breakpoint
CREATE TABLE `transaction_items` (
	`id` text PRIMARY KEY NOT NULL,
	`transaction_id` text NOT NULL,
	`type` text NOT NULL,
	`copy_id` text,
	`product_id` text,
	`rental_id` text,
	`description` text,
	`amount` integer NOT NULL,
	`tax` integer DEFAULT 0,
	FOREIGN KEY (`transaction_id`) REFERENCES `transactions`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`copy_id`) REFERENCES `copies`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`product_id`) REFERENCES `products`(`id`) ON UPDATE no action ON DELETE no action,
	FOREIGN KEY (`rental_id`) REFERENCES `rentals`(`id`) ON UPDATE no action ON DELETE no action
);
--> statement-breakpoint
CREATE INDEX `transaction_items_transaction_id_idx` ON `transaction_items` (`transaction_id`);--> statement-breakpoint
CREATE TABLE `transactions` (
	`id` text PRIMARY KEY NOT NULL,
	`customer_id` text NOT NULL,
	`type` text NOT NULL,
	`subtotal` integer NOT NULL,
	`tax` integer DEFAULT 0,
	`total` integer NOT NULL,
	`payment_method` text NOT NULL,
	`amount_tendered` integer,
	`change_given` integer,
	`voided` integer DEFAULT 0,
	`void_reason` text,
	`notes` text,
	`created_at` text DEFAULT (datetime('now')),
	FOREIGN KEY (`customer_id`) REFERENCES `customers`(`id`) ON UPDATE no action ON DELETE no action
);
