# Database

MySQL / MariaDB (utf8mb4) through Prisma 7 with the `@prisma/adapter-mariadb` driver adapter (no Rust query engine, which keeps shared hosting deployments simple). The schema lives in `packages/database/prisma/schema.prisma`; migrations in `packages/database/prisma/migrations`.

## Conventions

- Primary keys: `uuid(7)` stored as `CHAR(36)` (time-ordered, good InnoDB locality).
- Every business table has `organizationId` and is queried through it (multi-tenancy).
- Soft deletes use `deletedAt`; `TrashItem` indexes what is restorable and when it is purged.
- Raw provider payloads are stored on `LeadSocialAccount.raw` / `ClientSocialAccount.raw` / `ContentItem.raw`; normalized fields live in the row itself.
- Contacts (`LeadContact`, `ClientContact`) carry `source` (`PROFILE`, `WEBSITE`, `FACEBOOK_PAGE`, `INSTAGRAM_BIO`, `SEARCH_ENGINE`, `MANUAL`, `AI_INFERRED`) and `confidence` (`VERIFIED`, `PUBLIC`, `INFERRED`).
- Full-text indexes: `knowledge_chunks(content)` and `leads(brandName, bio)` via `@@fulltext`.

## Model groups

| Group | Models |
|---|---|
| Identity | `User`, `Session`, `Organization`, `OrganizationMember`, `OrganizationCounter`, `OrganizationSettings` |
| Discovery | `SearchRun`, `SavedSearch`, `ProviderRun`, `Lead`, `LeadSocialAccount`, `LeadContact`, `SearchRunLead`, `LeadTag` |
| CRM | `Client`, `ClientSocialAccount`, `ClientContact`, `Tag`, `ClientTag`, `Note`, `Activity` |
| Messaging | `SocialConnection`, `Conversation`, `Message`, `MessageAttachment`, `ScheduledMessage`, `MessageJob`, `ExtensionDevice`, `ExtensionPairing`, `WebhookEvent` |
| Campaigns | `Campaign`, `CampaignLead` |
| AI | `AIInstruction`, `KnowledgeDocument`, `KnowledgeChunk`, `AIActionLog` |
| Ops | `AutomationJob`, `AuditLog`, `UsageRecord`, `Document`, `TrashItem`, `ProviderConfig` |
| Analysis | `CompetitorSearch`, `TrendSearch`, `ContentItem` |

## CID generation

`OrganizationCounter(organizationId, key='client_cid')` is incremented with a single `UPDATE` inside the caller's transaction and read back on the same connection (`allocateClientCid`). Numbers are never reused, so `CX-000001`, `CX-000002`, … are unique for the lifetime of an organization even after permanent deletion. The unique constraints `(organizationId, cid)` and `(organizationId, cidSequence)` enforce this at the database level. Concurrency is covered by an integration test.

## Important indexes

`organizationId` composites on every list query (status, createdAt, followers, leadScore, websiteDomain, email, phone, username), `(organizationId, platform, username)` unique on social accounts, `(organizationId, channel, externalThreadId)` unique on conversations, `(organizationId, channel, externalMessageId)` unique on messages (webhook idempotency), `(provider, externalEventId)` unique on webhook events, `dedupeKey` unique on automation jobs, `(status, scheduledAt, priority)` for job claiming.

## Commands

```bash
pnpm db:migrate     # prisma migrate dev (creates + applies migrations)
pnpm db:deploy      # prisma migrate deploy (production)
pnpm db:push        # schema push without migration files (prototyping only)
pnpm db:generate    # regenerate the client + model aliases (runs on install)
pnpm db:seed        # demo organization
pnpm db:studio      # Prisma Studio
```

`packages/database/scripts/model-aliases.mjs` generates `src/models.ts` after every `prisma generate` so services can import plain row types (`Lead`, `Client`, …) instead of Prisma 7's `LeadModel` names.
