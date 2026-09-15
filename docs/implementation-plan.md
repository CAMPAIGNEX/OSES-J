# OSES-J — Implementation Plan

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

_Updated 2026-09-15._ Phases 1-12 are the product scope from the specification; 13-15 were added while shipping (design system, operator control room, mobile app experience). "Built" means implemented, type-checked and covered by the unit / integration suites; "hardening" lists what still needs real-world verification before it can be called production-proven.

| Phase | Scope | Status |
|---|---|---|
| 1 Foundation | monorepo, auth, org model, dashboard shell, navigation, settings | **built** |
| 2 Lead discovery | search UI, criteria, discovery service, Apify, normalization, dedupe, results, save | **built** · hardening: run against a live Apify token and verify each Actor's current schema |
| 3 Client CRM | Add to Business, CID, client list/profile, tags, notes, trash/restore | **built** |
| 4 Enrichment | website extraction, source tracking, entity resolution | **built** |
| 5 Messaging foundation | conversations, messages, jobs, scheduling, inbox, manual mode | **built** |
| 6 Browser extension | MV3 extension, pairing, job claim, IG composer detection, result reporting | **built** · hardening: Instagram/Facebook DOM selectors need re-checking on the live sites; not on the Chrome Web Store (load unpacked) |
| 7 Meta integrations | OAuth connect, token storage, webhooks, inbound sync, outbound where supported | **built** · hardening: needs a Meta app with App Review for messaging permissions |
| 8 Apify messaging provider | actor config, job submission, monitoring, result processing | **built** · hardening: depends on a DM Actor being configured (none is the default) |
| 9 AI assistant | instructions, TXT upload, knowledge base, generation, intents, summaries, action logs | **built** · hardening: prompt quality review on real conversations |
| 10 Autopilot | modes, auto-reply/follow-up, campaigns, timezone logic, escalation, pause/stop | **built** · hardening: run for days on a pilot workspace before enabling widely |
| 11 Analytics | performance dashboard with date ranges and interactive charts | **built** |
| 12 Competitor / trend analysis | reuse discovery + content normalization + AI reports | **built** |
| 13 Design system & public site | icons, fonts, Classic / Bauhaus Mix / Neo templates, website, manual, changelog | **built** |
| 14 OS-Panel (operators) | organisations, users, jobs, audit, system, per-workspace operations, platform Providers & keys | **built** |
| 15 Mobile app experience | PWA manifest + service worker, bottom tab bar, native-sized controls, bottom sheets, offline page | **built** · hardening: install on real iOS / Android devices and check every screen |
| 16 Production pilot | live keys in OS-Panel, first real workspace, real searches and sends, monitoring | **next** |

### Next phases (roadmap)

Each phase lists its modules; a module is one shippable unit (branch, tests, manual page, changelog entry).

**Phase 16 — Production pilot (now)**

| Module | What it delivers | Where |
|---|---|---|
| 16.1 Live keys | Apify token, Anthropic key, recommended Actors entered in OS-Panel → Providers & keys on production | operator task |
| 16.2 Actor schema verification | Run every recommended Actor once with the real token; adjust `packages/discovery/src/apify/adapters.ts` / `normalizers.ts` where an Actor's output changed | discovery |
| 16.3 First workspace | Register the first exporter, company facts, instructions, knowledge base | onboarding |
| 16.4 Data-quality audit | Review the first 200 leads: scores, contacts with sources, duplicates, cost per run | discovery / enrichment |
| 16.5 Monitoring & alerts | `/api/health` polling, failed-job alert e-mail to admin@cnexai.com, OS-Panel job SLA view | automation / OS-Panel |
| 16.6 Backups | Hostinger MySQL backup schedule + `STORAGE_DIR` backup, restore drill | operations |

**Phase 17 — Full Instagram & Facebook data coverage (posts, reels, hashtags, groups)**

| Module | What it delivers | Where |
|---|---|---|
| 17.1 Instagram Reels adapter | `apify/instagram-reel-scraper`: reels by profile and hashtag → content items + authors as leads | discovery adapters (CONTENT + DISCOVERY) |
| 17.2 Instagram posts & comments | `apify/instagram-post-scraper` + `apify/instagram-comment-scraper`: engaged accounts (commenters, tagged brands) as leads | discovery adapters |
| 17.3 Facebook posts & reels | `apify/facebook-posts-scraper`, `apify/facebook-reels-scraper`: page content + page discovery | discovery adapters |
| 17.4 Facebook hashtag / keyword content | `apify/facebook-hashtag-scraper` for trend and competitor analysis on Facebook | discovery adapters |
| 17.5 Facebook groups | `apify/facebook-groups-scraper`: posts and authors from public buyer / wholesale groups | discovery adapters |
| 17.6 Content library | Store posts/reels with engagement metrics and media references on `ContentItem`; browse per lead / client | database, CRM UI |
| 17.7 Analysis over all content | Competitor and trend reports use posts, reels and hashtags from both platforms | analysis |
| 17.8 Cost controls | Per-run cost caps and per-workspace monthly budgets managed in OS-Panel; usage shown to operators | OS-Panel, automation |

**Phase 18 — Messaging goes live**

| Module | What it delivers | Where |
|---|---|---|
| 18.1 Meta App Review | Business verification and permissions (`pages_messaging`, `instagram_manage_messages`, …) so the official API works for every workspace | Meta process |
| 18.2 Extension hardening | Re-check Instagram / Facebook DOM selectors, human-like delays, per-account safety caps | extension |
| 18.3 Chrome Web Store listing | Signed, auto-updating extension instead of "load unpacked" | extension |
| 18.4 WhatsApp Business channel | New `MessagingProvider` on the WhatsApp Cloud API (enriched phone numbers become a channel) | messaging |
| 18.5 E-mail channel | SMTP / API sending for enriched e-mail addresses, threaded into the inbox | messaging |
| 18.6 Account safety | Warm-up schedules, account health signals, automatic slow-down on warnings | messaging, automation |

**Phase 19 — Scale & operations**

| Module | What it delivers | Where |
|---|---|---|
| 19.1 Worker mode | `JOB_RUNNER_MODE=worker` on a VPS with the Redis/BullMQ queue driver | workers, automation |
| 19.2 Observability | Log shipping, error alerts, job SLA dashboards in OS-Panel | OS-Panel |
| 19.3 Plans & metering | Per-plan limits enforced from `UsageRecord`; invoices later | OS-Panel, billing |
| 19.4 Data retention & GDPR | Workspace export / delete, data-subject requests | database, OS-Panel |
| 19.5 Load testing | Search, inbox and job throughput under load | tests |

**Phase 20 — Growth**

| Module | What it delivers | Where |
|---|---|---|
| 20.1 Team collaboration | Assignments, mentions, shared inbox views | inbox |
| 20.2 Multi-language AI | Urdu, Arabic, Spanish, … replies and instructions | ai |
| 20.3 Quotes & proposals | Documents → quotes / PDF proposals sent from the inbox | documents, messaging |
| 20.4 Integrations | Google Sheets / Excel sync, webhooks, CRM export | api |
| 20.5 Native wrappers | Capacitor iOS / Android builds of the PWA with push notifications | mobile |
| 20.6 Onboarding wizard | Guided first-run setup and in-app guide | web |

## 4. Non‑negotiable rules carried into code

- Every business table has `organizationId`; every query is scoped through a request context.
- Raw provider output is stored separately from normalized leads; nothing is invented.
- Every contact field carries `source` + `confidence`.
- Messaging eligibility is an explicit state, never inferred from a profile URL.
- Every automated action writes an `AIActionLog` and/or `AuditLog` row.
- AI never bypasses org settings (mode, approvals, working hours, rate limits, do‑not‑contact).
