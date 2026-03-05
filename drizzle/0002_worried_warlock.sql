ALTER TABLE `transactions` ADD `reference_code` text;--> statement-breakpoint
CREATE UNIQUE INDEX `transactions_reference_code_unique` ON `transactions` (`reference_code`);