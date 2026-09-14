# OSES J — Implementation Plan

_Status: living document. Created at project start (repository was empty)._

## 0. Repository inspection (done before any code)

- Repository was empty (`.git` only, no commits, no framework, no auth, no deployment config).
- Local machine: Node 24, pnpm 9.15, XAMPP MariaDB 10.4.32 on `127.0.0.1:3306` (root, no password), no Redis, no Docker.
- Port 3000 is used by another app on this machine, so the dev server runs on **3100**.
- Verified before designing: Prisma 7.10 (Rust‑free client + `@prisma/adapter-mariadb`) works against
  this MariaDB: JSON columns round‑trip as objects, JSON path filters, Decimal, interactive
  transactions and raw SQL all pass. Prisma 7 conventions confirmed from the official
  `prisma init` output: `prisma.config.ts` holds the datasource URL, the `prisma-client` generator
  requires `output`, and the client is constructed with `new PrismaClient({ adapter })`.

## 1. Technology decisions

| Concern | Decision | Why |
|---|---|---|
| Monorepo | pnpm workspaces, TypeScript source packages consumed directly (`transpilePackages`) | No build step for packages; one type‑check per package |
| Web | Next.js 16 (App Router), React 19, Tailwind 4 | Spec requirement |
| ORM | Prisma 7.10 + `@prisma/adapter-mariadb` | Spec prefers Prisma; no engine binaries → friendlier to shared hosting |
| DB | MySQL / MariaDB (`utf8mb4`) | Spec: do not migrate to PostgreSQL |
| Auth | Own session auth (DB sessions, hashed cookie token, scrypt passwords) | Spec: secure session‑based auth; full control over org scoping |
| Validation | Zod 4 | Spec |
| Queue | `JobQueue` abstraction, MySQL driver shipped; Redis/BullMQ is a driver slot | Hostinger Business has no Redis; workers must be separable |
| Job execution | `JOB_RUNNER_MODE = inline \| cron \| worker` | Works on Hostinger (inline / cron endpoint) and on a VPS (worker) |
| AI | `AIProvider` abstraction: Anthropic + OpenAI‑compatible | Spec: replaceable provider |
| Discovery | `DiscoveryProvider` abstraction: Apify (actor adapters) | Spec |
| Messaging | `MessagingProvider` abstraction: manual, browser extension, Apify, Meta | Spec |
| Extension | Chrome MV3, TypeScript, esbuild | Spec |
| Logging | Small structured JSON logger with secret redaction | Avoids bundler issues with worker‑thread loggers inside Next.js |
| Tests | Vitest (unit in packages, integration against MySQL when `TEST_DATABASE_URL` is set) | Spec |

## 2. Package map

```
apps/web            Next.js UI + REST API routes (the only HTTP surface)
apps/extension      Chrome MV3 extension (separate deployable)
packages/shared     env, logger, errors, crypto, ids, timezone, text/url/phone utils, constants
packages/validation Zod schemas shared by API + UI
packages/database   Prisma schema, generated client, db singleton, CID generator, audit/AI‑action/usage writers
packages/apify      Thin Apify REST client (vendor SDK isolated here)
packages/discovery  DiscoveryProvider, Apify actor adapters, query parser, normalizer, dedupe, scoring, LeadDiscoveryService
packages/enrichment EnrichmentProvider, website contact extraction (SSRF‑guarded), profile enrichment, entity resolution
packages/messaging  MessagingProvider, resolver, providers, ConversationService, MessageService, Meta Graph client, webhooks
packages/ai         AIProvider, providers, prompt building, knowledge (chunking/retrieval), SalesAgent, rule validation
packages/automation JobQueue (MySQL driver), JobRunner, retry/backoff, scheduler (scheduled messages, follow‑ups, campaigns, trash)
workers             Standalone worker process composing all job handlers
tests               Integration / end‑to‑end tests
docs                Architecture and setup documentation
```

## 3. Phase status

| Phase | Scope | Status |
|---|---|---|
| 1 Foundation | monorepo, auth, org model, dashboard shell, navigation, settings shell | in progress |
| 2 Lead discovery | search UI, criteria, discovery service, Apify, normalization, dedupe, results, save | planned |
| 3 Client CRM | Add to Business, CID, client list/profile, tags, notes, trash/restore | planned |
| 4 Enrichment | website extraction, source tracking, entity resolution | planned |
| 5 Messaging foundation | conversations, messages, jobs, scheduling, inbox, manual mode | planned |
| 6 Browser extension | MV3 extension, pairing, job claim, IG composer detection, result reporting | planned |
| 7 Meta integrations | OAuth connect, token storage, webhooks, inbound sync, outbound where supported | planned |
| 8 Apify messaging provider | actor config, job submission, monitoring, result processing | planned |
| 9 AI assistant | instructions, TXT upload, knowledge base, generation, intents, summaries, action logs | planned |
| 10 Autopilot | modes, auto‑reply/follow‑up, campaigns, timezone logic, escalation, pause/stop | planned |
| 11 Analytics | performance dashboard with date ranges and interactive charts | planned |
| 12 Competitor / trend analysis | reuse discovery + content normalization + AI reports | planned |

## 4. Non‑negotiable rules carried into code

- Every business table has `organizationId`; every query is scoped through a request context.
- Raw provider output is stored separately from normalized leads; nothing is invented.
- Every contact field carries `source` + `confidence`.
- Messaging eligibility is an explicit state, never inferred from a profile URL.
- Every automated action writes an `AIActionLog` and/or `AuditLog` row.
- AI never bypasses org settings (mode, approvals, working hours, rate limits, do‑not‑contact).
