# Architecture

## Domains

```
DISCOVERY → ENRICHMENT → LEAD MANAGEMENT → CRM → MESSAGING → AI SALES AGENT → AUTOMATION → ANALYTICS
```

Each domain is a workspace package with a small public surface. Packages depend "downwards" only:

```
apps/web ──► automation ──► ai, messaging, enrichment, discovery, crm
                │              │          │              │
                └──────────────┴──────────┴──────────────┴──► database ──► shared
                                             apify ◄── discovery / messaging
```

- **shared**: environment loading (`getEnv`), structured logger with secret redaction, `AppError` model with `ErrorClass` for retry decisions, crypto (scrypt passwords, AES-256-GCM secrets), timezone resolution, text/url/contact normalization, SSRF guard, storage abstraction.
- **database**: Prisma 7 schema and client (MariaDB driver adapter, no Rust engine), CID allocator, audit log, usage metering, trash helpers, organization settings parsing.
- **discovery**: `DiscoveryProvider` / `ProfileProvider` / `ContentProvider` contracts, the Apify implementation with Actor adapters, query parser, normalizer (raw → `NormalizedLead` with sourced contacts), dedupe (deterministic keys → fuzzy), scoring, orchestrator, lead repository/services.
- **enrichment**: `EnrichmentProvider` contract, website extraction (home + contact page, JSON-LD, mailto/tel/wa.me, social links), profile enrichment through discovery's profile providers, client enrichment.
- **crm**: Add to Business (CID allocation, duplicate/restore handling), client CRUD, notes, tags.
- **messaging**: `MessagingProvider` contract, providers (manual, browser extension, Apify, Meta official), `MessagingProviderResolver`, conversation + message services, scheduling, delivery job results, extension pairing/claim protocol, Meta OAuth + webhooks.
- **ai**: `AIProvider` contract (Anthropic via official SDK, OpenAI-compatible via HTTP), knowledge chunking/retrieval, prompt building from organization facts, sales agent actions (analyze, first message, classify intent, reply, follow-up, summarize), deterministic rule validation, AI action logging.
- **automation**: `JobQueue` (MySQL driver; Redis slot), `JobRunner` with backoff and error classes, handlers for every job type, scheduler tick, autopilot policy, campaigns, XLSX export, trash purge, competitor/trend analysis orchestration.
- **apps/web**: the only HTTP surface — Next.js pages + REST route handlers using `withApi` (session, org scoping, validation, CSRF, error mapping).
- **apps/extension**: Chrome MV3 extension that claims delivery jobs and performs UI actions in the user's own session.

## Request flow (web)

```
Browser ─► Next.js route handler ─► withApi (session, org, zod, CSRF) ─► domain service ─► Prisma ─► MySQL
                                                                     └─► enqueueJob ─► JobQueue (MySQL)
                                                                                         └─► inline runner (after response) | cron tick | worker
```

## Job system

`AutomationJob` rows are claimed with a conditional `UPDATE ... WHERE status='QUEUED'` (works on MariaDB 10.4 / MySQL 5.7+ without `SKIP LOCKED`). Handlers run through `JobRunner`, which classifies errors (`TEMPORARY`, `RATE_LIMIT` → retry with 30s/2m/10m/30m backoff; `PERMANENT`, `AUTHENTICATION`, `USER_ACTION_REQUIRED`, `TARGET_UNAVAILABLE` → fail immediately). Every enqueue can carry a `dedupeKey`, so the scheduler is idempotent.

Modes (`JOB_RUNNER_MODE`):

| Mode | Where jobs run | Use |
|---|---|---|
| `inline` | Inside the web process: after the HTTP response (`after()`) and on a one-minute timer (`instrumentation.ts`), guarded against concurrent loops | development, shared hosting |
| `cron` | `POST /api/internal/jobs/tick` (bounded batch + scheduler tick) | Hostinger cron |
| `worker` | `pnpm worker` long-running process | VPS / container |

Delivery jobs (`MessageJob`) are separate from automation jobs: extension jobs are pulled by the device through the claim endpoint; Meta and Apify jobs are executed by the server (`MESSAGE_JOB`).

## Messaging provider resolution

```
official Meta API (needs connected account + existing thread)
  └─ else browser extension (online device, logged in)
       └─ else Apify DM Actor (token + actor configured)
            └─ else manual (user sends it, OSES-J records it)
```

The decision and every considered provider are stored on the message and job (`meta.decision`), so nothing switches silently. Messaging eligibility is an explicit state on each client social account (`DISCOVERED`, `MESSAGEABLE`, `NOT_MESSAGEABLE`, `REQUIRES_USER`, `PROVIDER_ERROR`).

## AI orchestration

```
inbound message → AI_REPLY_JOB → classify intent → escalation/confidence checks → generate reply → rule validation
   → Manual: classify only  |  Copilot: message awaiting approval  |  Autopilot: send (or schedule to next working slot)
```

All automated decisions go through `autopilot.ts` (mode, per-kind auto flags, approvals, confidence threshold, working hours, do-not-contact, rate limits) and are logged as `AUTOPILOT_DECISION` in `AIActionLog`.

## Multi-tenancy & security

Every business table carries `organizationId`; services receive `{ organizationId, userId }` from the session and never accept organization ids from the client. Secrets (Apify/AI/Meta tokens) are encrypted with `ENCRYPTION_KEY`; sessions store only token hashes; the extension authenticates with short-lived bearer tokens obtained through a pairing code. See [security.md](security.md).
