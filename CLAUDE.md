# OSES J — working notes for Claude Code

AI-powered social export sales system (lead discovery on Instagram/Facebook, CRM, AI-assisted messaging) for apparel exporters. pnpm monorepo, TypeScript everywhere.

## Layout

- `apps/web` — Next.js 16 App Router (`app/`, `components/`, `lib/`); the only HTTP surface. Route handlers use `withApi` from `lib/server/api.ts` (session, org scoping, zod body/query, CSRF origin check, error mapping, optional rate limit).
- `apps/extension` — Chrome MV3 extension (esbuild; `pnpm extension:build` → `dist/`).
- `packages/*` — domain packages: `shared`, `validation`, `database` (Prisma 7 + MariaDB adapter), `apify`, `discovery`, `enrichment`, `crm`, `messaging`, `ai`, `automation`. Dependencies only point downwards (see `docs/architecture.md`).
- `workers/` — standalone job worker (`pnpm worker`).
- `tests/` — Vitest unit + integration suites; `vitest.config.mts` at the root.
- `docs/` — architecture, database, discovery, enrichment, messaging, browser-extension, meta-integration, apify, ai-agent, deployment, security, testing.

## Commands

```
pnpm dev                      # web on http://localhost:3100 (JOB_RUNNER_MODE=inline runs jobs in-process)
pnpm typecheck                # tsc for every package (also run per package: cd packages/x && pnpm exec tsc --noEmit -p tsconfig.json)
pnpm test:unit                # fast, no DB
pnpm test:integration         # needs TEST_DATABASE_URL (migrations applied automatically)
pnpm build                    # prisma generate + next build
pnpm db:migrate | db:deploy | db:seed | db:studio
```

Local DB is XAMPP MariaDB (`oses_j_dev`, test DB `oses_j_test`); credentials in `.env` (git-ignored). Seeded login: `demo@oses-j.local` / `DemoPass123!`.

## Conventions

- Every service function takes `db` first and a `{ organizationId, userId }` context; never trust org ids from requests.
- External vendors only behind provider interfaces (`DiscoveryProvider`, `EnrichmentProvider`, `MessagingProvider`, `AIProvider`); Apify HTTP lives only in `packages/apify`.
- Never fabricate data: store contacts with `source` + `confidence`, keep lead location `null` unless a provider returned it, only mark messages `SENT` on confirmed sends.
- Errors extend `AppError` (`packages/shared/src/errors.ts`) with an `ErrorClass` that drives job retries (`retryDelayMs`).
- Prisma 7 model types are re-exported with plain names from `@oses/database` (`Lead`, `Client`, …) via the generated `src/models.ts`; regenerate with `pnpm db:generate` after schema changes, then `pnpm db:migrate`.
- Test hooks for injecting fakes: `setAIProviderForTests`, `setDiscoveryProvidersForTests`, `setProfileProvidersForTests`.
- Route handlers in `apps/web/app/api/**` are thin: validate, call a service, enqueue jobs through `lib/server/jobs.ts`.
- Keep file comments in the existing style (JSDoc on exported functions, short inline notes for non-obvious decisions).

## Gotchas

- `server-only` imports in `apps/web/lib/server/*` are aliased to an empty module in Vitest (`tests/src/support/server-only.ts`).
- The extension's `tsconfig` uses `types: ["chrome", "node"]`; content scripts are built as IIFE, background/popup as ESM.
- Windows: run shell steps through Git Bash; the C: drive is small, so build outputs and temp files should stay on D:.
