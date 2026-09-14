# OSES-J — working notes for Claude Code

AI-powered social export sales system (lead discovery on Instagram/Facebook, CRM, AI-assisted messaging) for apparel exporters. pnpm monorepo, TypeScript everywhere.

## Layout

- `apps/web` — Next.js 16 App Router (`app/`, `components/`, `lib/`); the only HTTP surface. Route handlers use `withApi` from `lib/server/api.ts` (session, org scoping, zod body/query, CSRF origin check, error mapping, optional rate limit).
- `apps/extension` — Chrome MV3 extension (esbuild; `pnpm extension:build` → `dist/`).
- `packages/*` — domain packages: `shared`, `validation`, `database` (Prisma 7 + MariaDB adapter), `apify`, `discovery`, `enrichment`, `crm`, `messaging`, `ai`, `automation`. Dependencies only point downwards (see `docs/architecture.md`).
- `workers/` — standalone job worker (`pnpm worker`).
- `tests/` — Vitest unit + integration suites; `vitest.config.mts` at the root.
- `docs/` — architecture, database, discovery, enrichment, messaging, browser-extension, meta-integration, apify, ai-agent, deployment, security, testing, os-panel.
- `apps/web/content/` — public website content: `features.ts` (feature registry) and `docs/*.md` (the user manual, rendered at `/docs`). **When a feature is added or changed, update the matching manual page, `features.ts` and `changelog.md` in the same change.**

## Commands

```
pnpm dev                      # web on http://localhost:3100 (JOB_RUNNER_MODE=inline runs jobs in-process)
pnpm typecheck                # tsc for every package (also run per package: cd packages/x && pnpm exec tsc --noEmit -p tsconfig.json)
pnpm test:unit                # fast, no DB
pnpm test:integration         # needs TEST_DATABASE_URL (migrations applied automatically)
pnpm build                    # prisma generate + next build (must work without .env / DB; hosts build first)
pnpm start                    # migrate deploy + next start on $PORT
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
- Icons come from `@/components/ui/icons` (Heroicons solid behind lucide-style names); never import lucide. UI templates are token-based: `html[data-template]` (cookie `oses_template`, per-workspace `OrganizationSettings.uiTemplate`) and CSS in `app/globals.css`; components expose `data-ui` hooks for template styling. Never put text on top of the halftone pattern.
- Backend/operations settings (provider keys, Actors, AI provider/model/key, job limits) are operator-only: never expose them on member screens; members see readiness only (Settings > Automation > Services). Operator-scoped calls use `?organizationId=` with `operatorOrgOverride: true`.
- Product name in copy is always `OSES-J` (with the hyphen). Contact: info@cnexai.com, +92 312 7233047, admin@cnexai.com.
- Mobile is a first-class target: bottom tab bar + drawer in `app-shell.tsx`, PWA manifest/service worker (`app/manifest.ts`, `public/sw.js`), 44px touch targets, 16px inputs below `lg`, bottom-sheet dialogs. Check phone width before shipping UI.
- Templates: Classic, Bauhaus Mix (`bauhaus`), Neo (`neo`); element rules live in `@scope` blocks so previews nest correctly; register new ones in `lib/templates.ts`, the validation enum and the Appearance preview.
- OS-Panel (`app/(os-panel)`, `app/api/os-panel`) is operators-only: `withApi({ superAdminOnly: true })` and a layout guard that returns 404; every mutation goes through `osAudit`.

## Gotchas

- `server-only` imports in `apps/web/lib/server/*` are aliased to an empty module in Vitest (`tests/src/support/server-only.ts`).
- The extension's `tsconfig` uses `types: ["chrome", "node"]`; content scripts are built as IIFE, background/popup as ESM.
- Windows: run shell steps through Git Bash; the C: drive is small, so build outputs and temp files should stay on D:.
- Keep `apps/web/next.config.mjs` as plain JS (a `.ts` config breaks builds on hosts with older Node). Hosting: Node 22, any pnpm 9-11 (no `packageManager` pin; strictness and release-age policy disabled in `.npmrc`/`pnpm-workspace.yaml`), entry file `server.js` at the root (runs Next in-process; migrations via `packages/database/scripts/migrate.mjs` since the host cannot exec Prisma engines). Any new dependency with an install script must be added to `allowBuilds` in `pnpm-workspace.yaml` or pnpm 11 hosts fail with ERR_PNPM_IGNORED_BUILDS.
