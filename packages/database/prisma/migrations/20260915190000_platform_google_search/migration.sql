-- AlterTable
ALTER TABLE `platform_settings` ADD COLUMN `googleApiKeyEncrypted` TEXT NULL,
    ADD COLUMN `googleCseId` VARCHAR(80) NULL;
