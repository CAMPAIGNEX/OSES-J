-- AlterTable
ALTER TABLE `organization_settings` ADD COLUMN `uiTemplate` VARCHAR(32) NOT NULL DEFAULT 'classic';

-- AlterTable
ALTER TABLE `organizations` ADD COLUMN `internalNotes` TEXT NULL,
    ADD COLUMN `plan` VARCHAR(40) NOT NULL DEFAULT 'standard',
    ADD COLUMN `status` ENUM('ACTIVE', 'SUSPENDED') NOT NULL DEFAULT 'ACTIVE',
    ADD COLUMN `suspendedAt` DATETIME(3) NULL,
    ADD COLUMN `suspendedReason` VARCHAR(300) NULL;

-- AlterTable
ALTER TABLE `users` ADD COLUMN `isSuperAdmin` BOOLEAN NOT NULL DEFAULT false;
