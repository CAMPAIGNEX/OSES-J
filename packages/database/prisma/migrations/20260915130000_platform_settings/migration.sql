-- CreateTable
CREATE TABLE `platform_settings` (
    `id` VARCHAR(20) NOT NULL DEFAULT 'platform',
    `apifyTokenEncrypted` TEXT NULL,
    `apifyEnabled` BOOLEAN NOT NULL DEFAULT true,
    `aiProvider` VARCHAR(40) NULL,
    `aiModel` VARCHAR(120) NULL,
    `aiBaseUrl` VARCHAR(500) NULL,
    `aiApiKeyEncrypted` TEXT NULL,
    `embeddingProvider` VARCHAR(40) NULL,
    `embeddingModel` VARCHAR(120) NULL,
    `embeddingApiKeyEncrypted` TEXT NULL,
    `metaAppId` VARCHAR(80) NULL,
    `metaAppSecretEncrypted` TEXT NULL,
    `metaWebhookVerifyToken` VARCHAR(200) NULL,
    `updatedByUserId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
