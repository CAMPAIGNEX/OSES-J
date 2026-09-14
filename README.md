# OSES J — AI-Powered Social Export Sales System

OSES J is an export-sales operating system for apparel, sportswear, hosiery and fitness-wear manufacturers (starting with exporters in Sialkot, Pakistan). It finds potential buyers on Instagram and Facebook, enriches their public business information, de-duplicates and organizes them as leads and clients, and lets the exporter contact and manage those prospects through a unified, AI-assisted sales workspace.

```
FIND  →  SAVE  →  ADD TO BUSINESS  →  AI CONTACT  →  FOLLOW UP  →  CLOSE
```

The platform supports human/manual operation, AI copilot mode (AI suggests, you approve) and AI autopilot mode (AI acts within the limits you configure). AI never bypasses organization settings, approvals, working hours, rate limits or do-not-contact flags.

## Architecture

```
apps/web            Next.js 16 (App Router) — UI + REST API (the only HTTP surface)
apps/extension      Chrome MV3 extension — browser automation in the user's own session
packages/shared     env, logging, errors, crypto, timezone, text/url/contact utilities, storage
packages/validation Zod schemas shared by API routes and UI forms
packages/database   Prisma 7 schema + MySQL/MariaDB client, CID allocator, audit/usage/trash helpers
packages/apify      Thin Apify REST client (the only place that knows Apify's HTTP API)
packages/discovery  DiscoveryProvider abstraction, Apify Actor adapters, query parser, normalizer, dedupe, scoring
packages/enrichment Website contact extraction (SSRF-guarded), profile enrichment, entity resolution
packages/crm        Clients: Add to Business, CID, duplicate detection, notes/tags/activities
packages/messaging  MessagingProvider abstraction (manual / extension / Apify / Meta), resolver, conversations, webhooks
packages/ai         AIProvider abstraction (Anthropic, OpenAI-compatible), knowledge base, sales agent, rule validation
packages/automation Job queue (MySQL driver), runner, scheduler, autopilot policy, campaigns, exports, trash
workers             Standalone worker process (VPS deployment)
tests               Unit + integration test suites (Vitest)
docs                Architecture and setup documentation
```

Domains are separated (Discovery → Enrichment → Lead management → CRM → Messaging → AI → Automation → Analytics) and every external vendor sits behind a provider interface so it can be replaced without touching business logic. See [docs/architecture.md](docs/architecture.md).

## Features

- **Search Leads** — natural-language queries ("New apparel brands in New York"), platform/follower/geo filters, configurable Apify Actors, search history and saved searches.
- **Normalization & deduplication** — provider output is normalized, every contact field carries a source and confidence, duplicates are merged deterministically (profile, id, website, email, phone) and then by fuzzy brand matching.
- **Saved Leads & Clients (CRM)** — Save, bulk actions, XLSX export, Add to Business with permanent CIDs (`CX-000001`), duplicate protection, tags, notes, activity timeline, trash with 7-day retention.
- **Messaging** — unified Instagram/Facebook inbox, AI composer (generate / regenerate / shorter / more professional / more friendly / personalize), manual send, automated send through the browser extension, Apify or the official Meta API, scheduling in the client's timezone, delivery jobs with transparent provider decisions.
- **AI Assistant** — company facts, instructions, prohibited claims, escalation rules, TXT knowledge base with retrieval (MySQL full-text, embeddings-ready), intent classification, reply/follow-up generation, business-rule validation, full AI action log, Manual / Copilot / Autopilot modes with human controls.
- **Campaigns** — audiences, AI or template first messages, follow-up ladders, working hours, daily limits, approval gates, pause/stop.
- **Meta integration** — OAuth connection of Pages/Instagram professional accounts, signed webhooks, idempotent inbound sync, delivery/read receipts, outbound replies where Meta permits.
- **Analytics** — dashboard, performance page with presets/custom ranges and interactive charts, competitor and trend analysis with observed data separated from AI interpretation.
- **Platform** — multi-tenant organizations, session auth, encrypted secrets, audit log, usage metering, job system with retries and error classes, Hostinger-friendly deployment modes.

## Technology stack

Next.js 16 · React 19 · TypeScript 5.9 · Tailwind CSS 4 · Prisma 7 (Rust-free client, `@prisma/adapter-mariadb`) · MySQL/MariaDB · Zod 4 · Vitest 5 · Anthropic SDK · Apify REST API · Chrome Manifest V3 · esbuild · exceljs · recharts · pnpm workspaces.

## Local development

Requirements: Node.js ≥ 20.9 (24 recommended), pnpm 9, MySQL 8 / MariaDB 10.4+.

```bash
pnpm install                      # installs everything and generates the Prisma client
cp .env.example .env              # then edit DATABASE_URL, AUTH_SECRET, ENCRYPTION_KEY
mysql -u root -e "CREATE DATABASE oses_j_dev CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci"
pnpm db:migrate                   # applies migrations (packages/database/prisma/migrations)
pnpm db:seed                      # demo organization: demo@oses-j.local / DemoPass123!
pnpm dev                          # http://localhost:3100
```

Generate secrets with `openssl rand -base64 48` (AUTH_SECRET) and `openssl rand -base64 32` (ENCRYPTION_KEY — must decode to 32 bytes).

Useful scripts:

| Script | Purpose |
|---|---|
| `pnpm dev` / `pnpm build` / `pnpm start` | Web app (port 3100) |
| `pnpm worker` | Standalone job worker (`JOB_RUNNER_MODE=worker`) |
| `pnpm extension:build` | Build the Chrome extension into `apps/extension/dist` |
| `pnpm db:migrate` / `pnpm db:deploy` / `pnpm db:studio` | Prisma migrate dev / deploy / Studio |
| `pnpm typecheck` | Type-check every package |
| `pnpm test` / `pnpm test:unit` / `pnpm test:integration` | Vitest suites |

## Environment variables

All configuration lives in one `.env` at the repository root (see [.env.example](.env.example) for every variable with comments). The important ones:

| Variable | Purpose |
|---|---|
| `DATABASE_URL` | `mysql://user:pass@host:3306/db` |
| `AUTH_SECRET`, `ENCRYPTION_KEY` | Session signing and AES-256-GCM encryption of stored secrets |
| `APP_URL`, `PORT` | Public URL (OAuth callbacks, CSRF origin checks) |
| `JOB_RUNNER_MODE` | `inline` (jobs run inside the web app), `cron` (POST `/api/internal/jobs/tick`), `worker` (`pnpm worker`) |
| `INTERNAL_JOB_SECRET` | Bearer secret for the cron tick endpoint |
| `AI_PROVIDER`, `AI_API_KEY`, `AI_MODEL` | Platform-default AI (`anthropic` → `claude-opus-5`); organizations can override in Settings |
| `APIFY_API_TOKEN`, `APIFY_*_ACTOR` | Discovery / enrichment / messaging Actors (organization overrides in Settings → Providers) |
| `META_APP_ID`, `META_APP_SECRET`, `META_WEBHOOK_VERIFY_TOKEN` | Official Meta integration |
| `STORAGE_DIR` | Local document storage directory |

## Database setup

The Prisma schema is in `packages/database/prisma/schema.prisma` (45 models, all business tables carry `organizationId`). Migrations are applied with `pnpm db:migrate` (development) or `pnpm db:deploy` (production). Full-text indexes are declared with `@@fulltext` and used by the knowledge retrieval fallback. See [docs/database.md](docs/database.md).

## Apify setup

1. Add your Apify token in **Settings → Automation** (stored encrypted) or set `APIFY_API_TOKEN`.
2. Choose Actors in **Settings → Providers** or through env variables. Defaults: `apify/google-search-scraper` (search-engine strategy), `apify/instagram-scraper`, `apify/instagram-profile-scraper`, `apify/instagram-hashtag-scraper`, `apify/facebook-pages-scraper`.
3. Use **Test** to verify the token and that an Actor exists. Actors are external providers: verify their input/output schema and adjust with `settings.inputOverrides` or the generic adapter's `inputTemplate`. See [docs/apify.md](docs/apify.md).

## Meta setup

Create a Meta app with Facebook Login + Messenger + Instagram messaging products, set `META_APP_ID/SECRET`, configure the webhook callback `https://<APP_URL>/api/webhooks/meta` with `META_WEBHOOK_VERIFY_TOKEN`, then connect Pages in **Settings → Social accounts**. See [docs/meta-integration.md](docs/meta-integration.md).

## Extension setup

```bash
pnpm extension:build
```

Load `apps/extension/dist` as an unpacked extension in Chrome (`chrome://extensions` → Developer mode → Load unpacked). In OSES J open **Settings → Automation → Pair extension**, enter the server URL and pairing code in the extension popup. See [docs/browser-extension.md](docs/browser-extension.md).

## AI setup

Set `AI_PROVIDER=anthropic` and `AI_API_KEY` (platform default), or configure a provider per organization in **AI Assistant → Behaviour & limits** (Anthropic, OpenAI or any OpenAI-compatible endpoint; keys are stored encrypted). Add company facts in **Settings → Company**, instructions and knowledge in **AI Assistant**. See [docs/ai-agent.md](docs/ai-agent.md).

## Testing

```bash
pnpm test:unit             # pure logic: parsing, dedupe, scoring, rules, timezones, crypto, retries, webhook security
pnpm test:integration      # real MySQL (TEST_DATABASE_URL): search → save → add → AI contact → send → inbox → replies → autopilot → failure cases
```

See [docs/testing.md](docs/testing.md).

## Deployment

Hostinger Business (shared hosting) runs the web app with `JOB_RUNNER_MODE=inline` or `cron`; a VPS runs the same web app plus `pnpm worker`. Step-by-step instructions, cron examples and the reverse-proxy notes are in [docs/deployment.md](docs/deployment.md).

## Troubleshooting

| Symptom | Check |
|---|---|
| "AI is not configured" | `AI_PROVIDER` / `AI_API_KEY` or the organization's key in AI Assistant settings |
| Searches complete with 0 results and a warning | Apify token missing or no provider for the platform (Settings → Automation / Providers) |
| "Message cannot be sent automatically" | The provider decision lists why each provider was skipped (no Meta thread, extension offline, Apify not configured). Use *Open in Instagram* to send manually |
| Extension shows "Waiting for heartbeat" | Pair it again; make sure the server URL is reachable from the browser and the org has the extension enabled |
| Jobs stay QUEUED | `JOB_RUNNER_MODE`: in `cron` mode call `/api/internal/jobs/tick`; in `worker` mode run `pnpm worker` |
| Meta webhook returns 401 | `META_APP_SECRET` mismatch (signature validation) |
| Build fails with ENOSPC | Free disk space (Next.js and Prisma need temp space) |
