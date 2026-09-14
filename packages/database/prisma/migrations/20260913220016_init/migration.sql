-- CreateTable
CREATE TABLE `users` (
    `id` CHAR(36) NOT NULL,
    `email` VARCHAR(191) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `passwordHash` VARCHAR(255) NOT NULL,
    `timezone` VARCHAR(64) NULL,
    `isActive` BOOLEAN NOT NULL DEFAULT true,
    `lastLoginAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `users_email_key`(`email`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `sessions` (
    `id` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `tokenHash` VARCHAR(64) NOT NULL,
    `activeOrganizationId` CHAR(36) NULL,
    `userAgent` VARCHAR(255) NULL,
    `ip` VARCHAR(64) NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `sessions_tokenHash_key`(`tokenHash`),
    INDEX `sessions_userId_idx`(`userId`),
    INDEX `sessions_expiresAt_idx`(`expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organizations` (
    `id` CHAR(36) NOT NULL,
    `name` VARCHAR(160) NOT NULL,
    `slug` VARCHAR(80) NOT NULL,
    `description` TEXT NULL,
    `website` VARCHAR(500) NULL,
    `country` VARCHAR(80) NULL,
    `city` VARCHAR(80) NULL,
    `address` VARCHAR(300) NULL,
    `products` TEXT NULL,
    `moq` VARCHAR(300) NULL,
    `certifications` TEXT NULL,
    `shippingInfo` TEXT NULL,
    `productionCapacity` VARCHAR(500) NULL,
    `contactEmail` VARCHAR(254) NULL,
    `contactPhone` VARCHAR(40) NULL,
    `timezone` VARCHAR(64) NOT NULL DEFAULT 'Asia/Karachi',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,
    `deletedAt` DATETIME(3) NULL,

    UNIQUE INDEX `organizations_slug_key`(`slug`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_members` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `role` ENUM('OWNER', 'ADMIN', 'MEMBER') NOT NULL DEFAULT 'MEMBER',
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `organization_members_userId_idx`(`userId`),
    UNIQUE INDEX `organization_members_organizationId_userId_key`(`organizationId`, `userId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_counters` (
    `organizationId` CHAR(36) NOT NULL,
    `key` VARCHAR(40) NOT NULL,
    `value` INTEGER NOT NULL DEFAULT 0,

    PRIMARY KEY (`organizationId`, `key`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `organization_settings` (
    `organizationId` CHAR(36) NOT NULL,
    `messagingMode` ENUM('MANUAL', 'COPILOT', 'AUTOPILOT') NOT NULL DEFAULT 'MANUAL',
    `autopilotEnabled` BOOLEAN NOT NULL DEFAULT false,
    `autopilotEnabledAt` DATETIME(3) NULL,
    `defaultChannel` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL DEFAULT 'INSTAGRAM',
    `workingHours` JSON NULL,
    `followUpDays` JSON NULL,
    `messagesPerHour` INTEGER NOT NULL DEFAULT 20,
    `messagesPerDay` INTEGER NOT NULL DEFAULT 100,
    `minMinutesBetweenMessages` INTEGER NOT NULL DEFAULT 2,
    `aiProvider` VARCHAR(40) NULL,
    `aiModel` VARCHAR(120) NULL,
    `aiBaseUrl` VARCHAR(500) NULL,
    `aiApiKeyEncrypted` TEXT NULL,
    `aiTemperature` DOUBLE NOT NULL DEFAULT 0.7,
    `aiTone` VARCHAR(200) NULL,
    `aiLanguage` VARCHAR(40) NULL,
    `autoReply` BOOLEAN NOT NULL DEFAULT false,
    `autoFollowUp` BOOLEAN NOT NULL DEFAULT false,
    `autoFirstMessage` BOOLEAN NOT NULL DEFAULT false,
    `requireApprovalFirstMessage` BOOLEAN NOT NULL DEFAULT true,
    `requireApprovalAttachments` BOOLEAN NOT NULL DEFAULT true,
    `confidenceThreshold` DOUBLE NOT NULL DEFAULT 0.75,
    `escalatePricing` BOOLEAN NOT NULL DEFAULT true,
    `escalateNegotiation` BOOLEAN NOT NULL DEFAULT true,
    `escalateComplaints` BOOLEAN NOT NULL DEFAULT true,
    `escalateUnusual` BOOLEAN NOT NULL DEFAULT true,
    `apifyTokenEncrypted` TEXT NULL,
    `apifyEnabled` BOOLEAN NOT NULL DEFAULT true,
    `maxConcurrentJobs` INTEGER NOT NULL DEFAULT 2,
    `maxRetries` INTEGER NOT NULL DEFAULT 3,
    `jobTimeoutSec` INTEGER NOT NULL DEFAULT 600,
    `extensionEnabled` BOOLEAN NOT NULL DEFAULT true,
    `preferredProvider` VARCHAR(20) NOT NULL DEFAULT 'auto',
    `extra` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    PRIMARY KEY (`organizationId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_runs` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `savedSearchId` CHAR(36) NULL,
    `query` VARCHAR(300) NOT NULL,
    `criteria` JSON NOT NULL,
    `strategy` VARCHAR(40) NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'ENRICHING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `stage` VARCHAR(40) NULL,
    `providerSummary` JSON NULL,
    `totalRaw` INTEGER NOT NULL DEFAULT 0,
    `totalNormalized` INTEGER NOT NULL DEFAULT 0,
    `totalDeduped` INTEGER NOT NULL DEFAULT 0,
    `totalNew` INTEGER NOT NULL DEFAULT 0,
    `totalEnriched` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `jobId` CHAR(36) NULL,
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `search_runs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `search_runs_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `saved_searches` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NULL,
    `name` VARCHAR(120) NOT NULL,
    `criteria` JSON NOT NULL,
    `lastRunAt` DATETIME(3) NULL,
    `runCount` INTEGER NOT NULL DEFAULT 0,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `saved_searches_organizationId_deletedAt_idx`(`organizationId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_runs` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `searchRunId` CHAR(36) NULL,
    `purpose` VARCHAR(40) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `actorId` VARCHAR(200) NOT NULL,
    `adapter` VARCHAR(80) NULL,
    `externalRunId` VARCHAR(120) NULL,
    `datasetId` VARCHAR(120) NULL,
    `status` ENUM('CREATED', 'RUNNING', 'SUCCEEDED', 'FAILED', 'TIMED_OUT', 'ABORTED') NOT NULL DEFAULT 'CREATED',
    `input` JSON NULL,
    `itemCount` INTEGER NULL,
    `costUsd` DECIMAL(10, 4) NULL,
    `error` TEXT NULL,
    `startedAt` DATETIME(3) NULL,
    `finishedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `provider_runs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `provider_runs_externalRunId_idx`(`externalRunId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `leads` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `dedupeKey` VARCHAR(191) NOT NULL,
    `brandName` VARCHAR(191) NOT NULL,
    `name` VARCHAR(191) NULL,
    `primaryPlatform` ENUM('INSTAGRAM', 'FACEBOOK') NULL,
    `username` VARCHAR(120) NULL,
    `profileUrl` VARCHAR(500) NULL,
    `inboxUrl` VARCHAR(500) NULL,
    `externalId` VARCHAR(120) NULL,
    `followers` INTEGER NULL,
    `following` INTEGER NULL,
    `postsCount` INTEGER NULL,
    `bio` TEXT NULL,
    `website` VARCHAR(500) NULL,
    `websiteDomain` VARCHAR(191) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `whatsapp` VARCHAR(40) NULL,
    `country` VARCHAR(80) NULL,
    `region` VARCHAR(80) NULL,
    `city` VARCHAR(80) NULL,
    `address` VARCHAR(300) NULL,
    `category` VARCHAR(120) NULL,
    `source` VARCHAR(40) NULL,
    `sourceActor` VARCHAR(200) NULL,
    `sourceTimestamp` DATETIME(3) NULL,
    `timezone` VARCHAR(64) NULL,
    `leadScore` INTEGER NOT NULL DEFAULT 0,
    `scoreBreakdown` JSON NULL,
    `status` ENUM('DISCOVERED', 'SAVED', 'ADDED', 'ARCHIVED') NOT NULL DEFAULT 'DISCOVERED',
    `isSaved` BOOLEAN NOT NULL DEFAULT false,
    `savedAt` DATETIME(3) NULL,
    `savedByUserId` CHAR(36) NULL,
    `clientId` CHAR(36) NULL,
    `enrichmentStatus` ENUM('NONE', 'PENDING', 'RUNNING', 'COMPLETED', 'PARTIAL', 'FAILED') NOT NULL DEFAULT 'NONE',
    `enrichedAt` DATETIME(3) NULL,
    `enrichmentError` TEXT NULL,
    `notes` TEXT NULL,
    `firstSearchRunId` CHAR(36) NULL,
    `discoveredAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `lastSeenAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `leads_clientId_key`(`clientId`),
    INDEX `leads_organizationId_status_deletedAt_idx`(`organizationId`, `status`, `deletedAt`),
    INDEX `leads_organizationId_isSaved_idx`(`organizationId`, `isSaved`),
    INDEX `leads_organizationId_leadScore_idx`(`organizationId`, `leadScore`),
    INDEX `leads_organizationId_followers_idx`(`organizationId`, `followers`),
    INDEX `leads_organizationId_websiteDomain_idx`(`organizationId`, `websiteDomain`),
    INDEX `leads_organizationId_email_idx`(`organizationId`, `email`),
    INDEX `leads_organizationId_phone_idx`(`organizationId`, `phone`),
    INDEX `leads_organizationId_username_idx`(`organizationId`, `username`),
    INDEX `leads_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    UNIQUE INDEX `leads_organizationId_dedupeKey_key`(`organizationId`, `dedupeKey`),
    FULLTEXT INDEX `leads_brandName_bio_idx`(`brandName`, `bio`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_social_accounts` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL,
    `username` VARCHAR(120) NULL,
    `profileUrl` VARCHAR(500) NOT NULL,
    `externalId` VARCHAR(120) NULL,
    `inboxUrl` VARCHAR(500) NULL,
    `externalThreadId` VARCHAR(120) NULL,
    `displayName` VARCHAR(191) NULL,
    `followers` INTEGER NULL,
    `following` INTEGER NULL,
    `postsCount` INTEGER NULL,
    `bio` TEXT NULL,
    `category` VARCHAR(120) NULL,
    `isBusiness` BOOLEAN NULL,
    `isVerified` BOOLEAN NULL,
    `isPrivate` BOOLEAN NULL,
    `website` VARCHAR(500) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `lastPostAt` DATETIME(3) NULL,
    `raw` JSON NULL,
    `sourceProvider` VARCHAR(40) NOT NULL,
    `sourceActor` VARCHAR(200) NULL,
    `providerRunId` CHAR(36) NULL,
    `fetchedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `lead_social_accounts_organizationId_platform_externalId_idx`(`organizationId`, `platform`, `externalId`),
    INDEX `lead_social_accounts_leadId_idx`(`leadId`),
    UNIQUE INDEX `lead_social_accounts_organizationId_platform_username_key`(`organizationId`, `platform`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_contacts` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `type` ENUM('EMAIL', 'PHONE', 'WHATSAPP', 'WEBSITE', 'ADDRESS') NOT NULL,
    `value` VARCHAR(500) NOT NULL,
    `normalizedValue` VARCHAR(191) NOT NULL,
    `source` ENUM('PROFILE', 'WEBSITE', 'FACEBOOK_PAGE', 'INSTAGRAM_BIO', 'SEARCH_ENGINE', 'MANUAL', 'AI_INFERRED') NOT NULL,
    `sourceUrl` VARCHAR(500) NULL,
    `confidence` ENUM('VERIFIED', 'PUBLIC', 'INFERRED') NOT NULL DEFAULT 'PUBLIC',
    `label` VARCHAR(80) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `lead_contacts_organizationId_type_normalizedValue_idx`(`organizationId`, `type`, `normalizedValue`),
    UNIQUE INDEX `lead_contacts_leadId_type_normalizedValue_key`(`leadId`, `type`, `normalizedValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `search_run_leads` (
    `id` CHAR(36) NOT NULL,
    `searchRunId` CHAR(36) NOT NULL,
    `leadId` CHAR(36) NOT NULL,
    `rank` INTEGER NOT NULL DEFAULT 0,
    `matchedExisting` BOOLEAN NOT NULL DEFAULT false,
    `matchedBy` VARCHAR(60) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `search_run_leads_leadId_idx`(`leadId`),
    UNIQUE INDEX `search_run_leads_searchRunId_leadId_key`(`searchRunId`, `leadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `clients` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `cid` VARCHAR(20) NOT NULL,
    `cidSequence` INTEGER NOT NULL,
    `brandName` VARCHAR(191) NOT NULL,
    `companyName` VARCHAR(191) NULL,
    `category` VARCHAR(120) NULL,
    `website` VARCHAR(500) NULL,
    `websiteDomain` VARCHAR(191) NULL,
    `email` VARCHAR(254) NULL,
    `phone` VARCHAR(40) NULL,
    `whatsapp` VARCHAR(40) NULL,
    `country` VARCHAR(80) NULL,
    `region` VARCHAR(80) NULL,
    `city` VARCHAR(80) NULL,
    `address` VARCHAR(300) NULL,
    `timezone` VARCHAR(64) NULL,
    `timezoneSource` VARCHAR(20) NULL,
    `followers` INTEGER NULL,
    `bio` TEXT NULL,
    `source` VARCHAR(40) NULL,
    `leadScore` INTEGER NOT NULL DEFAULT 0,
    `status` ENUM('NEW', 'CONTACTED', 'REPLIED', 'INTERESTED', 'NEGOTIATING', 'CUSTOMER', 'NOT_INTERESTED', 'DO_NOT_CONTACT', 'ARCHIVED') NOT NULL DEFAULT 'NEW',
    `doNotContact` BOOLEAN NOT NULL DEFAULT false,
    `doNotContactReason` VARCHAR(300) NULL,
    `ownerUserId` CHAR(36) NULL,
    `createdByUserId` CHAR(36) NULL,
    `lastContactedAt` DATETIME(3) NULL,
    `lastReplyAt` DATETIME(3) NULL,
    `lastActivityAt` DATETIME(3) NULL,
    `aiSummary` TEXT NULL,
    `aiAnalysis` JSON NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `clients_organizationId_status_deletedAt_idx`(`organizationId`, `status`, `deletedAt`),
    INDEX `clients_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `clients_organizationId_websiteDomain_idx`(`organizationId`, `websiteDomain`),
    INDEX `clients_organizationId_email_idx`(`organizationId`, `email`),
    INDEX `clients_organizationId_phone_idx`(`organizationId`, `phone`),
    INDEX `clients_organizationId_lastActivityAt_idx`(`organizationId`, `lastActivityAt`),
    UNIQUE INDEX `clients_organizationId_cid_key`(`organizationId`, `cid`),
    UNIQUE INDEX `clients_organizationId_cidSequence_key`(`organizationId`, `cidSequence`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_social_accounts` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL,
    `username` VARCHAR(120) NULL,
    `profileUrl` VARCHAR(500) NOT NULL,
    `externalId` VARCHAR(120) NULL,
    `inboxUrl` VARCHAR(500) NULL,
    `externalThreadId` VARCHAR(120) NULL,
    `scopedUserId` VARCHAR(120) NULL,
    `displayName` VARCHAR(191) NULL,
    `followers` INTEGER NULL,
    `following` INTEGER NULL,
    `postsCount` INTEGER NULL,
    `bio` TEXT NULL,
    `category` VARCHAR(120) NULL,
    `isBusiness` BOOLEAN NULL,
    `isVerified` BOOLEAN NULL,
    `isPrivate` BOOLEAN NULL,
    `messagingEligibility` ENUM('DISCOVERED', 'MESSAGEABLE', 'NOT_MESSAGEABLE', 'REQUIRES_USER', 'PROVIDER_ERROR') NOT NULL DEFAULT 'DISCOVERED',
    `eligibilityReason` VARCHAR(300) NULL,
    `eligibilityCheckedAt` DATETIME(3) NULL,
    `raw` JSON NULL,
    `sourceProvider` VARCHAR(40) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `client_social_accounts_organizationId_platform_externalId_idx`(`organizationId`, `platform`, `externalId`),
    INDEX `client_social_accounts_organizationId_platform_scopedUserId_idx`(`organizationId`, `platform`, `scopedUserId`),
    INDEX `client_social_accounts_clientId_idx`(`clientId`),
    UNIQUE INDEX `client_social_accounts_organizationId_platform_username_key`(`organizationId`, `platform`, `username`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_contacts` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `type` ENUM('EMAIL', 'PHONE', 'WHATSAPP', 'WEBSITE', 'ADDRESS') NOT NULL,
    `value` VARCHAR(500) NOT NULL,
    `normalizedValue` VARCHAR(191) NOT NULL,
    `source` ENUM('PROFILE', 'WEBSITE', 'FACEBOOK_PAGE', 'INSTAGRAM_BIO', 'SEARCH_ENGINE', 'MANUAL', 'AI_INFERRED') NOT NULL,
    `sourceUrl` VARCHAR(500) NULL,
    `confidence` ENUM('VERIFIED', 'PUBLIC', 'INFERRED') NOT NULL DEFAULT 'PUBLIC',
    `label` VARCHAR(80) NULL,
    `isPrimary` BOOLEAN NOT NULL DEFAULT false,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `client_contacts_organizationId_type_normalizedValue_idx`(`organizationId`, `type`, `normalizedValue`),
    UNIQUE INDEX `client_contacts_clientId_type_normalizedValue_key`(`clientId`, `type`, `normalizedValue`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `tags` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(60) NOT NULL,
    `color` VARCHAR(7) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `tags_organizationId_name_key`(`organizationId`, `name`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `client_tags` (
    `clientId` CHAR(36) NOT NULL,
    `tagId` CHAR(36) NOT NULL,

    INDEX `client_tags_tagId_idx`(`tagId`),
    PRIMARY KEY (`clientId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `lead_tags` (
    `leadId` CHAR(36) NOT NULL,
    `tagId` CHAR(36) NOT NULL,

    INDEX `lead_tags_tagId_idx`(`tagId`),
    PRIMARY KEY (`leadId`, `tagId`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `notes` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NULL,
    `leadId` CHAR(36) NULL,
    `userId` CHAR(36) NULL,
    `body` TEXT NOT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `notes_clientId_deletedAt_idx`(`clientId`, `deletedAt`),
    INDEX `notes_leadId_deletedAt_idx`(`leadId`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `activities` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `type` VARCHAR(60) NOT NULL,
    `title` VARCHAR(200) NOT NULL,
    `description` TEXT NULL,
    `meta` JSON NULL,
    `actorType` ENUM('USER', 'AI', 'SYSTEM') NOT NULL DEFAULT 'SYSTEM',
    `userId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `activities_clientId_createdAt_idx`(`clientId`, `createdAt`),
    INDEX `activities_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `social_connections` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL,
    `provider` VARCHAR(40) NOT NULL DEFAULT 'meta',
    `externalAccountId` VARCHAR(120) NOT NULL,
    `pageId` VARCHAR(120) NULL,
    `username` VARCHAR(120) NULL,
    `displayName` VARCHAR(191) NULL,
    `accessTokenEncrypted` TEXT NULL,
    `tokenExpiresAt` DATETIME(3) NULL,
    `scopes` JSON NULL,
    `status` ENUM('CONNECTED', 'EXPIRED', 'DISCONNECTED', 'ERROR') NOT NULL DEFAULT 'CONNECTED',
    `lastError` TEXT NULL,
    `meta` JSON NULL,
    `connectedByUserId` CHAR(36) NULL,
    `lastSyncedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `social_connections_platform_externalAccountId_idx`(`platform`, `externalAccountId`),
    UNIQUE INDEX `social_connections_organizationId_platform_externalAccountId_key`(`organizationId`, `platform`, `externalAccountId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `conversations` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `channel` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL,
    `clientSocialAccountId` CHAR(36) NULL,
    `socialConnectionId` CHAR(36) NULL,
    `externalThreadId` VARCHAR(120) NULL,
    `status` ENUM('OPEN', 'CLOSED', 'ARCHIVED') NOT NULL DEFAULT 'OPEN',
    `lastMessageAt` DATETIME(3) NULL,
    `lastInboundAt` DATETIME(3) NULL,
    `lastOutboundAt` DATETIME(3) NULL,
    `lastMessagePreview` VARCHAR(300) NULL,
    `messageCount` INTEGER NOT NULL DEFAULT 0,
    `unreadCount` INTEGER NOT NULL DEFAULT 0,
    `assignedUserId` CHAR(36) NULL,
    `aiStatus` VARCHAR(30) NOT NULL DEFAULT 'idle',
    `lastIntent` VARCHAR(40) NULL,
    `lastIntentConfidence` DOUBLE NULL,
    `summary` TEXT NULL,
    `summaryUpdatedAt` DATETIME(3) NULL,
    `needsHumanReview` BOOLEAN NOT NULL DEFAULT false,
    `needsHumanReason` VARCHAR(300) NULL,
    `campaignId` CHAR(36) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `conversations_organizationId_lastMessageAt_idx`(`organizationId`, `lastMessageAt`),
    INDEX `conversations_organizationId_status_deletedAt_idx`(`organizationId`, `status`, `deletedAt`),
    INDEX `conversations_clientId_channel_idx`(`clientId`, `channel`),
    UNIQUE INDEX `conversations_organizationId_channel_externalThreadId_key`(`organizationId`, `channel`, `externalThreadId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `messages` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `conversationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `channel` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL,
    `direction` ENUM('INBOUND', 'OUTBOUND') NOT NULL,
    `authorType` ENUM('USER', 'AI', 'SYSTEM', 'CLIENT') NOT NULL,
    `userId` CHAR(36) NULL,
    `body` TEXT NOT NULL,
    `status` ENUM('DRAFT', 'PENDING_APPROVAL', 'QUEUED', 'SENDING', 'SENT', 'DELIVERED', 'SEEN', 'FAILED', 'UNAVAILABLE', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `approvalStatus` ENUM('NONE', 'PENDING', 'APPROVED', 'REJECTED') NOT NULL DEFAULT 'NONE',
    `approvedByUserId` CHAR(36) NULL,
    `approvedAt` DATETIME(3) NULL,
    `providerKey` VARCHAR(40) NULL,
    `providerMessageId` VARCHAR(191) NULL,
    `externalMessageId` VARCHAR(191) NULL,
    `aiGenerated` BOOLEAN NOT NULL DEFAULT false,
    `aiModel` VARCHAR(120) NULL,
    `aiActionLogId` CHAR(36) NULL,
    `campaignId` CHAR(36) NULL,
    `scheduledMessageId` CHAR(36) NULL,
    `sentAt` DATETIME(3) NULL,
    `deliveredAt` DATETIME(3) NULL,
    `seenAt` DATETIME(3) NULL,
    `failedAt` DATETIME(3) NULL,
    `failureReason` TEXT NULL,
    `errorClass` ENUM('TEMPORARY', 'PERMANENT', 'AUTHENTICATION', 'RATE_LIMIT', 'TARGET_UNAVAILABLE', 'USER_ACTION_REQUIRED') NULL,
    `meta` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `messages_conversationId_createdAt_idx`(`conversationId`, `createdAt`),
    INDEX `messages_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `messages_organizationId_direction_status_idx`(`organizationId`, `direction`, `status`),
    INDEX `messages_campaignId_idx`(`campaignId`),
    UNIQUE INDEX `messages_organizationId_channel_externalMessageId_key`(`organizationId`, `channel`, `externalMessageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_attachments` (
    `id` CHAR(36) NOT NULL,
    `messageId` CHAR(36) NOT NULL,
    `documentId` CHAR(36) NULL,
    `name` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(120) NULL,
    `sizeBytes` INTEGER NULL,
    `url` VARCHAR(1000) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `message_attachments_messageId_idx`(`messageId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `scheduled_messages` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `conversationId` CHAR(36) NULL,
    `channel` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL,
    `body` TEXT NOT NULL,
    `scheduledAt` DATETIME(3) NOT NULL,
    `timezone` VARCHAR(64) NOT NULL,
    `timezoneMode` VARCHAR(20) NOT NULL DEFAULT 'client',
    `status` ENUM('PENDING_APPROVAL', 'SCHEDULED', 'QUEUED', 'SENT', 'CANCELLED', 'FAILED') NOT NULL DEFAULT 'SCHEDULED',
    `createdByType` ENUM('USER', 'AI', 'SYSTEM') NOT NULL DEFAULT 'USER',
    `createdByUserId` CHAR(36) NULL,
    `campaignId` CHAR(36) NULL,
    `campaignLeadId` CHAR(36) NULL,
    `followUpStep` INTEGER NULL,
    `messageId` CHAR(36) NULL,
    `aiActionLogId` CHAR(36) NULL,
    `jobId` CHAR(36) NULL,
    `error` TEXT NULL,
    `sentAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `scheduled_messages_organizationId_status_scheduledAt_idx`(`organizationId`, `status`, `scheduledAt`),
    INDEX `scheduled_messages_clientId_status_idx`(`clientId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `message_jobs` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `messageId` CHAR(36) NOT NULL,
    `conversationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `provider` ENUM('EXTENSION', 'APIFY', 'META') NOT NULL,
    `status` ENUM('QUEUED', 'CLAIMED', 'OPENING_TARGET', 'TARGET_FOUND', 'COMPOSER_FOUND', 'SENDING', 'SENT', 'FAILED', 'RETRYING', 'BLOCKED', 'REQUIRES_USER', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `target` JSON NOT NULL,
    `payload` JSON NOT NULL,
    `priority` INTEGER NOT NULL DEFAULT 5,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `scheduledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `claimedAt` DATETIME(3) NULL,
    `claimedByDeviceId` CHAR(36) NULL,
    `leaseExpiresAt` DATETIME(3) NULL,
    `lastHeartbeatAt` DATETIME(3) NULL,
    `progressDetail` VARCHAR(500) NULL,
    `result` JSON NULL,
    `errorCode` VARCHAR(60) NULL,
    `errorMessage` TEXT NULL,
    `errorClass` ENUM('TEMPORARY', 'PERMANENT', 'AUTHENTICATION', 'RATE_LIMIT', 'TARGET_UNAVAILABLE', 'USER_ACTION_REQUIRED') NULL,
    `providerRunId` CHAR(36) NULL,
    `completedAt` DATETIME(3) NULL,
    `cancelledAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `message_jobs_messageId_key`(`messageId`),
    INDEX `message_jobs_organizationId_provider_status_scheduledAt_idx`(`organizationId`, `provider`, `status`, `scheduledAt`),
    INDEX `message_jobs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extension_devices` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `name` VARCHAR(120) NOT NULL,
    `browser` VARCHAR(120) NULL,
    `extensionVersion` VARCHAR(40) NULL,
    `status` ENUM('PENDING', 'ONLINE', 'OFFLINE', 'REVOKED') NOT NULL DEFAULT 'PENDING',
    `accessTokenHash` VARCHAR(64) NULL,
    `accessTokenExpiresAt` DATETIME(3) NULL,
    `refreshTokenHash` VARCHAR(64) NULL,
    `refreshTokenExpiresAt` DATETIME(3) NULL,
    `lastSeenAt` DATETIME(3) NULL,
    `lastStatus` VARCHAR(30) NULL,
    `capabilities` JSON NULL,
    `revokedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `extension_devices_accessTokenHash_key`(`accessTokenHash`),
    UNIQUE INDEX `extension_devices_refreshTokenHash_key`(`refreshTokenHash`),
    INDEX `extension_devices_organizationId_status_idx`(`organizationId`, `status`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `extension_pairings` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `userId` CHAR(36) NOT NULL,
    `codeHash` VARCHAR(64) NOT NULL,
    `expiresAt` DATETIME(3) NOT NULL,
    `usedAt` DATETIME(3) NULL,
    `deviceId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    UNIQUE INDEX `extension_pairings_codeHash_key`(`codeHash`),
    INDEX `extension_pairings_organizationId_expiresAt_idx`(`organizationId`, `expiresAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `webhook_events` (
    `id` CHAR(36) NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `externalEventId` VARCHAR(191) NOT NULL,
    `objectType` VARCHAR(40) NULL,
    `organizationId` CHAR(36) NULL,
    `payload` JSON NOT NULL,
    `status` ENUM('RECEIVED', 'PROCESSED', 'FAILED', 'IGNORED') NOT NULL DEFAULT 'RECEIVED',
    `error` TEXT NULL,
    `receivedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `processedAt` DATETIME(3) NULL,

    INDEX `webhook_events_status_receivedAt_idx`(`status`, `receivedAt`),
    UNIQUE INDEX `webhook_events_provider_externalEventId_key`(`provider`, `externalEventId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaigns` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(140) NOT NULL,
    `status` ENUM('DRAFT', 'SCHEDULED', 'RUNNING', 'PAUSED', 'COMPLETED', 'CANCELLED') NOT NULL DEFAULT 'DRAFT',
    `channel` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL DEFAULT 'INSTAGRAM',
    `audienceType` VARCHAR(20) NOT NULL DEFAULT 'CLIENTS',
    `audienceFilter` JSON NULL,
    `firstMessageMode` VARCHAR(20) NOT NULL DEFAULT 'AI',
    `template` TEXT NULL,
    `followUps` JSON NULL,
    `workingHours` JSON NULL,
    `timezoneMode` VARCHAR(20) NOT NULL DEFAULT 'client',
    `customTimezone` VARCHAR(64) NULL,
    `messagesPerDay` INTEGER NOT NULL DEFAULT 30,
    `requireApproval` BOOLEAN NOT NULL DEFAULT true,
    `startAt` DATETIME(3) NULL,
    `startedAt` DATETIME(3) NULL,
    `pausedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `stats` JSON NULL,
    `createdByUserId` CHAR(36) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `campaigns_organizationId_status_deletedAt_idx`(`organizationId`, `status`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `campaign_leads` (
    `id` CHAR(36) NOT NULL,
    `campaignId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NOT NULL,
    `status` ENUM('PENDING', 'SCHEDULED', 'CONTACTED', 'REPLIED', 'STOPPED', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `currentStep` INTEGER NOT NULL DEFAULT 0,
    `nextActionAt` DATETIME(3) NULL,
    `conversationId` CHAR(36) NULL,
    `lastMessageAt` DATETIME(3) NULL,
    `stopReason` VARCHAR(200) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `campaign_leads_campaignId_status_nextActionAt_idx`(`campaignId`, `status`, `nextActionAt`),
    UNIQUE INDEX `campaign_leads_campaignId_clientId_key`(`campaignId`, `clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_instructions` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `kind` ENUM('COMPANY', 'PRODUCTS', 'TONE', 'RULES', 'PROHIBITED', 'ESCALATION', 'WORKING_HOURS', 'CUSTOM') NOT NULL DEFAULT 'CUSTOM',
    `title` VARCHAR(140) NOT NULL,
    `content` TEXT NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `sortOrder` INTEGER NOT NULL DEFAULT 0,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `ai_instructions_organizationId_enabled_sortOrder_idx`(`organizationId`, `enabled`, `sortOrder`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_documents` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `documentId` CHAR(36) NULL,
    `title` VARCHAR(200) NOT NULL,
    `sourceType` ENUM('TEXT', 'FILE') NOT NULL DEFAULT 'TEXT',
    `status` ENUM('PENDING', 'PROCESSING', 'READY', 'FAILED') NOT NULL DEFAULT 'PENDING',
    `contentText` LONGTEXT NULL,
    `charCount` INTEGER NOT NULL DEFAULT 0,
    `chunkCount` INTEGER NOT NULL DEFAULT 0,
    `error` TEXT NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `knowledge_documents_documentId_key`(`documentId`),
    INDEX `knowledge_documents_organizationId_status_deletedAt_idx`(`organizationId`, `status`, `deletedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `knowledge_chunks` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `knowledgeDocumentId` CHAR(36) NOT NULL,
    `chunkIndex` INTEGER NOT NULL,
    `content` TEXT NOT NULL,
    `tokenEstimate` INTEGER NOT NULL DEFAULT 0,
    `embedding` JSON NULL,
    `embeddingModel` VARCHAR(120) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `knowledge_chunks_organizationId_knowledgeDocumentId_chunkInd_idx`(`organizationId`, `knowledgeDocumentId`, `chunkIndex`),
    FULLTEXT INDEX `knowledge_chunks_content_idx`(`content`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `ai_action_logs` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `clientId` CHAR(36) NULL,
    `conversationId` CHAR(36) NULL,
    `messageId` CHAR(36) NULL,
    `campaignId` CHAR(36) NULL,
    `action` ENUM('ANALYZE_LEAD', 'GENERATE_FIRST_MESSAGE', 'GENERATE_REPLY', 'GENERATE_FOLLOW_UP', 'CLASSIFY_INTENT', 'SUMMARIZE_CONVERSATION', 'RECOMMEND_NEXT_ACTION', 'VALIDATE_RULES', 'RESOLVE_DUPLICATE', 'PARSE_QUERY', 'COMPETITOR_ANALYSIS', 'TREND_ANALYSIS', 'AUTOPILOT_DECISION') NOT NULL,
    `status` ENUM('SUCCESS', 'FAILED', 'BLOCKED') NOT NULL DEFAULT 'SUCCESS',
    `triggeredBy` ENUM('USER', 'AI', 'SYSTEM') NOT NULL DEFAULT 'USER',
    `userId` CHAR(36) NULL,
    `provider` VARCHAR(40) NULL,
    `model` VARCHAR(120) NULL,
    `inputContext` JSON NULL,
    `output` JSON NULL,
    `decision` JSON NULL,
    `confidence` DOUBLE NULL,
    `tokensIn` INTEGER NULL,
    `tokensOut` INTEGER NULL,
    `durationMs` INTEGER NULL,
    `error` TEXT NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `ai_action_logs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `ai_action_logs_organizationId_action_createdAt_idx`(`organizationId`, `action`, `createdAt`),
    INDEX `ai_action_logs_clientId_createdAt_idx`(`clientId`, `createdAt`),
    INDEX `ai_action_logs_conversationId_idx`(`conversationId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `automation_jobs` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NULL,
    `type` ENUM('DISCOVERY_JOB', 'ENRICHMENT_JOB', 'MESSAGE_JOB', 'FOLLOWUP_JOB', 'AI_REPLY_JOB', 'AI_FIRST_MESSAGE_JOB', 'EXPORT_JOB', 'DOCUMENT_PROCESSING_JOB', 'TRASH_CLEANUP_JOB', 'CAMPAIGN_STEP_JOB', 'SCHEDULED_MESSAGE_JOB', 'COMPETITOR_ANALYSIS_JOB', 'TREND_ANALYSIS_JOB', 'WEBHOOK_EVENT_JOB') NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED', 'CANCELLED') NOT NULL DEFAULT 'QUEUED',
    `priority` INTEGER NOT NULL DEFAULT 5,
    `payload` JSON NOT NULL,
    `result` JSON NULL,
    `attempts` INTEGER NOT NULL DEFAULT 0,
    `maxAttempts` INTEGER NOT NULL DEFAULT 3,
    `scheduledAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `startedAt` DATETIME(3) NULL,
    `completedAt` DATETIME(3) NULL,
    `lockedAt` DATETIME(3) NULL,
    `lockedBy` VARCHAR(120) NULL,
    `lockExpiresAt` DATETIME(3) NULL,
    `error` TEXT NULL,
    `errorClass` ENUM('TEMPORARY', 'PERMANENT', 'AUTHENTICATION', 'RATE_LIMIT', 'TARGET_UNAVAILABLE', 'USER_ACTION_REQUIRED') NULL,
    `dedupeKey` VARCHAR(191) NULL,
    `parentJobId` CHAR(36) NULL,
    `entityType` VARCHAR(40) NULL,
    `entityId` CHAR(36) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `automation_jobs_dedupeKey_key`(`dedupeKey`),
    INDEX `automation_jobs_status_scheduledAt_priority_idx`(`status`, `scheduledAt`, `priority`),
    INDEX `automation_jobs_organizationId_type_status_idx`(`organizationId`, `type`, `status`),
    INDEX `automation_jobs_entityType_entityId_idx`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `audit_logs` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NULL,
    `userId` CHAR(36) NULL,
    `actorType` ENUM('USER', 'AI', 'SYSTEM') NOT NULL DEFAULT 'USER',
    `action` VARCHAR(80) NOT NULL,
    `entityType` VARCHAR(40) NULL,
    `entityId` VARCHAR(64) NULL,
    `meta` JSON NULL,
    `ip` VARCHAR(64) NULL,
    `userAgent` VARCHAR(255) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `audit_logs_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    INDEX `audit_logs_organizationId_entityType_entityId_idx`(`organizationId`, `entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `usage_records` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `metric` ENUM('SEARCHES', 'LEADS_DISCOVERED', 'ENRICHMENT_REQUESTS', 'AI_REQUESTS', 'AI_TOKENS_IN', 'AI_TOKENS_OUT', 'MESSAGES_SENT', 'AUTOMATION_JOBS', 'EXPORTS', 'STORAGE_BYTES') NOT NULL,
    `day` DATE NOT NULL,
    `quantity` INTEGER NOT NULL DEFAULT 0,
    `meta` JSON NULL,
    `updatedAt` DATETIME(3) NOT NULL,

    UNIQUE INDEX `usage_records_organizationId_metric_day_key`(`organizationId`, `metric`, `day`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `documents` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(255) NOT NULL,
    `originalName` VARCHAR(255) NOT NULL,
    `mimeType` VARCHAR(120) NOT NULL,
    `sizeBytes` INTEGER NOT NULL,
    `storageKey` VARCHAR(500) NOT NULL,
    `storageDriver` VARCHAR(20) NOT NULL DEFAULT 'local',
    `kind` ENUM('CATALOG', 'PRICE_LIST', 'COMPANY_PROFILE', 'MOQ_SHEET', 'SIZE_CHART', 'PRODUCTION_INFO', 'KNOWLEDGE', 'EXPORT', 'OTHER') NOT NULL DEFAULT 'OTHER',
    `clientId` CHAR(36) NULL,
    `conversationId` CHAR(36) NULL,
    `campaignId` CHAR(36) NULL,
    `uploadedByUserId` CHAR(36) NULL,
    `checksum` VARCHAR(64) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `documents_organizationId_kind_deletedAt_idx`(`organizationId`, `kind`, `deletedAt`),
    INDEX `documents_clientId_idx`(`clientId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trash_items` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `entityType` ENUM('CLIENT', 'DOCUMENT', 'LEAD', 'CAMPAIGN', 'NOTE', 'CONVERSATION', 'SAVED_SEARCH') NOT NULL,
    `entityId` CHAR(36) NOT NULL,
    `label` VARCHAR(255) NOT NULL,
    `deletedByUserId` CHAR(36) NULL,
    `deletedAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `purgeAt` DATETIME(3) NOT NULL,
    `restoredAt` DATETIME(3) NULL,
    `purgedAt` DATETIME(3) NULL,
    `meta` JSON NULL,

    INDEX `trash_items_organizationId_restoredAt_purgedAt_idx`(`organizationId`, `restoredAt`, `purgedAt`),
    INDEX `trash_items_purgeAt_idx`(`purgeAt`),
    UNIQUE INDEX `trash_items_entityType_entityId_key`(`entityType`, `entityId`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `provider_configs` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NULL,
    `domain` ENUM('DISCOVERY', 'ENRICHMENT', 'MESSAGING', 'CONTENT') NOT NULL,
    `provider` VARCHAR(40) NOT NULL,
    `platform` VARCHAR(20) NOT NULL,
    `actorId` VARCHAR(200) NOT NULL,
    `adapter` VARCHAR(80) NOT NULL,
    `enabled` BOOLEAN NOT NULL DEFAULT true,
    `priority` INTEGER NOT NULL DEFAULT 1,
    `costLimitUsd` DECIMAL(10, 2) NULL,
    `timeoutSec` INTEGER NOT NULL DEFAULT 600,
    `settings` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `provider_configs_organizationId_domain_platform_enabled_prio_idx`(`organizationId`, `domain`, `platform`, `enabled`, `priority`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `competitor_searches` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(140) NULL,
    `criteria` JSON NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `resultSummary` JSON NULL,
    `aiReport` TEXT NULL,
    `itemCount` INTEGER NOT NULL DEFAULT 0,
    `jobId` CHAR(36) NULL,
    `error` TEXT NULL,
    `createdByUserId` CHAR(36) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `competitor_searches_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `trend_searches` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `name` VARCHAR(140) NULL,
    `criteria` JSON NOT NULL,
    `status` ENUM('QUEUED', 'RUNNING', 'COMPLETED', 'FAILED') NOT NULL DEFAULT 'QUEUED',
    `resultSummary` JSON NULL,
    `aiReport` TEXT NULL,
    `itemCount` INTEGER NOT NULL DEFAULT 0,
    `jobId` CHAR(36) NULL,
    `error` TEXT NULL,
    `createdByUserId` CHAR(36) NULL,
    `deletedAt` DATETIME(3) NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),
    `updatedAt` DATETIME(3) NOT NULL,

    INDEX `trend_searches_organizationId_createdAt_idx`(`organizationId`, `createdAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- CreateTable
CREATE TABLE `content_items` (
    `id` CHAR(36) NOT NULL,
    `organizationId` CHAR(36) NOT NULL,
    `competitorSearchId` CHAR(36) NULL,
    `trendSearchId` CHAR(36) NULL,
    `platform` ENUM('INSTAGRAM', 'FACEBOOK') NOT NULL,
    `accountUsername` VARCHAR(120) NULL,
    `accountName` VARCHAR(191) NULL,
    `accountUrl` VARCHAR(500) NULL,
    `postUrl` VARCHAR(500) NULL,
    `externalId` VARCHAR(120) NULL,
    `postedAt` DATETIME(3) NULL,
    `caption` TEXT NULL,
    `hashtags` JSON NULL,
    `likes` INTEGER NULL,
    `comments` INTEGER NULL,
    `views` INTEGER NULL,
    `mediaType` VARCHAR(30) NULL,
    `location` VARCHAR(191) NULL,
    `category` VARCHAR(120) NULL,
    `raw` JSON NULL,
    `createdAt` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3),

    INDEX `content_items_competitorSearchId_idx`(`competitorSearchId`),
    INDEX `content_items_trendSearchId_idx`(`trendSearchId`),
    INDEX `content_items_organizationId_platform_postedAt_idx`(`organizationId`, `platform`, `postedAt`),
    PRIMARY KEY (`id`)
) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;

-- AddForeignKey
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_members` ADD CONSTRAINT `organization_members_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_counters` ADD CONSTRAINT `organization_counters_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `organization_settings` ADD CONSTRAINT `organization_settings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `search_runs` ADD CONSTRAINT `search_runs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `search_runs` ADD CONSTRAINT `search_runs_savedSearchId_fkey` FOREIGN KEY (`savedSearchId`) REFERENCES `saved_searches`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `saved_searches` ADD CONSTRAINT `saved_searches_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_runs` ADD CONSTRAINT `provider_runs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_runs` ADD CONSTRAINT `provider_runs_searchRunId_fkey` FOREIGN KEY (`searchRunId`) REFERENCES `search_runs`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `leads` ADD CONSTRAINT `leads_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_social_accounts` ADD CONSTRAINT `lead_social_accounts_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_contacts` ADD CONSTRAINT `lead_contacts_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `search_run_leads` ADD CONSTRAINT `search_run_leads_searchRunId_fkey` FOREIGN KEY (`searchRunId`) REFERENCES `search_runs`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `search_run_leads` ADD CONSTRAINT `search_run_leads_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `clients` ADD CONSTRAINT `clients_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_social_accounts` ADD CONSTRAINT `client_social_accounts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_contacts` ADD CONSTRAINT `client_contacts_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `tags` ADD CONSTRAINT `tags_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_tags` ADD CONSTRAINT `client_tags_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `client_tags` ADD CONSTRAINT `client_tags_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_tags` ADD CONSTRAINT `lead_tags_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `lead_tags` ADD CONSTRAINT `lead_tags_tagId_fkey` FOREIGN KEY (`tagId`) REFERENCES `tags`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `notes` ADD CONSTRAINT `notes_leadId_fkey` FOREIGN KEY (`leadId`) REFERENCES `leads`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `activities` ADD CONSTRAINT `activities_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `social_connections` ADD CONSTRAINT `social_connections_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_clientSocialAccountId_fkey` FOREIGN KEY (`clientSocialAccountId`) REFERENCES `client_social_accounts`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `conversations` ADD CONSTRAINT `conversations_socialConnectionId_fkey` FOREIGN KEY (`socialConnectionId`) REFERENCES `social_connections`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `messages` ADD CONSTRAINT `messages_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_attachments` ADD CONSTRAINT `message_attachments_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_attachments` ADD CONSTRAINT `message_attachments_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_messages` ADD CONSTRAINT `scheduled_messages_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_messages` ADD CONSTRAINT `scheduled_messages_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_messages` ADD CONSTRAINT `scheduled_messages_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `scheduled_messages` ADD CONSTRAINT `scheduled_messages_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_jobs` ADD CONSTRAINT `message_jobs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_jobs` ADD CONSTRAINT `message_jobs_messageId_fkey` FOREIGN KEY (`messageId`) REFERENCES `messages`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_jobs` ADD CONSTRAINT `message_jobs_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `message_jobs` ADD CONSTRAINT `message_jobs_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extension_devices` ADD CONSTRAINT `extension_devices_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extension_devices` ADD CONSTRAINT `extension_devices_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `extension_pairings` ADD CONSTRAINT `extension_pairings_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaigns` ADD CONSTRAINT `campaigns_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_leads` ADD CONSTRAINT `campaign_leads_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `campaign_leads` ADD CONSTRAINT `campaign_leads_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_instructions` ADD CONSTRAINT `ai_instructions_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_documents` ADD CONSTRAINT `knowledge_documents_documentId_fkey` FOREIGN KEY (`documentId`) REFERENCES `documents`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `knowledge_chunks` ADD CONSTRAINT `knowledge_chunks_knowledgeDocumentId_fkey` FOREIGN KEY (`knowledgeDocumentId`) REFERENCES `knowledge_documents`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_action_logs` ADD CONSTRAINT `ai_action_logs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `ai_action_logs` ADD CONSTRAINT `ai_action_logs_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `automation_jobs` ADD CONSTRAINT `automation_jobs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `audit_logs` ADD CONSTRAINT `audit_logs_userId_fkey` FOREIGN KEY (`userId`) REFERENCES `users`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `usage_records` ADD CONSTRAINT `usage_records_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_clientId_fkey` FOREIGN KEY (`clientId`) REFERENCES `clients`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_conversationId_fkey` FOREIGN KEY (`conversationId`) REFERENCES `conversations`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `documents` ADD CONSTRAINT `documents_campaignId_fkey` FOREIGN KEY (`campaignId`) REFERENCES `campaigns`(`id`) ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trash_items` ADD CONSTRAINT `trash_items_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `provider_configs` ADD CONSTRAINT `provider_configs_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `competitor_searches` ADD CONSTRAINT `competitor_searches_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `trend_searches` ADD CONSTRAINT `trend_searches_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_items` ADD CONSTRAINT `content_items_organizationId_fkey` FOREIGN KEY (`organizationId`) REFERENCES `organizations`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_items` ADD CONSTRAINT `content_items_competitorSearchId_fkey` FOREIGN KEY (`competitorSearchId`) REFERENCES `competitor_searches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE `content_items` ADD CONSTRAINT `content_items_trendSearchId_fkey` FOREIGN KEY (`trendSearchId`) REFERENCES `trend_searches`(`id`) ON DELETE CASCADE ON UPDATE CASCADE;
