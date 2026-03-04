ALTER TABLE `family_members` ADD `birthday` text;--> statement-breakpoint
ALTER TABLE `family_members` ADD `active` integer DEFAULT 1;--> statement-breakpoint
CREATE INDEX `family_members_customer_id_idx` ON `family_members` (`customer_id`);--> statement-breakpoint
ALTER TABLE `titles` ADD `director` text;--> statement-breakpoint
ALTER TABLE `titles` ADD `media_type` text DEFAULT 'movie';--> statement-breakpoint
ALTER TABLE `titles` ADD `number_of_seasons` integer;--> statement-breakpoint
CREATE INDEX `copies_title_id_idx` ON `copies` (`title_id`);--> statement-breakpoint
CREATE INDEX `copies_status_idx` ON `copies` (`status`);--> statement-breakpoint
CREATE INDEX `rentals_customer_id_idx` ON `rentals` (`customer_id`);--> statement-breakpoint
CREATE INDEX `rentals_copy_id_idx` ON `rentals` (`copy_id`);--> statement-breakpoint
CREATE INDEX `rentals_status_idx` ON `rentals` (`status`);--> statement-breakpoint
CREATE INDEX `reservations_customer_id_idx` ON `reservations` (`customer_id`);--> statement-breakpoint
CREATE INDEX `reservations_title_id_idx` ON `reservations` (`title_id`);--> statement-breakpoint
CREATE INDEX `transaction_items_transaction_id_idx` ON `transaction_items` (`transaction_id`);