# OS-Panel (platform operators)

The OS-Panel is the control room for the CNEX AI team. It lives at `/os-panel` in the same application but is invisible to customers: anyone who is not a platform operator receives a 404 for the pages and every `/api/os-panel/*` route.

## Access

- Operators are users with `isSuperAdmin = true`.
- Bootstrap: list operator emails in `SUPER_ADMIN_EMAILS` (comma-separated). Those users become operators on their next login; they are also treated as operators immediately, before the flag is persisted.
- Operators can grant or revoke operator access to other users from *Users*; nobody can revoke their own access or deactivate themselves.
- Operators keep their normal workspace memberships; the app sidebar shows an *OS-Panel* link.

## Screens

| Screen | What it does |
|---|---|
| Overview | Platform counters (organizations, users, clients, messages, jobs, AI actions, extensions online), newest workspaces, recent failed jobs |
| Organizations | Search and filter workspaces; open one to see members, usage, configuration snapshot (mode, template, limits, provider keys present), recent audit; rename, change plan, suspend/activate with a reason shown to members, internal notes, soft delete |
| Users | Search accounts; open one to see workspaces, sessions, devices and activity; disable/activate, reset password (temporary, signs out everywhere), revoke sessions, add to a workspace or change role, grant/revoke operator |
| Jobs | The automation queue across all workspaces with status counts; retry failed/cancelled jobs, cancel queued/running ones |
| Audit log | Every audit event platform-wide with filters; OS-Panel operations are prefixed `os.` and carry the operator email |
| System | Configuration check (variable names only), runtime, database latency, queue depth, platform provider defaults, devices and Meta connections |

## Providers & keys (platform-wide)

`/os-panel/platform` is the single place where everything that runs behind OSES-J is configured for **all** workspaces:

- **Apify token** for discovery, enrichment and content search, plus a platform-wide discovery on/off switch.
- **AI provider** (Anthropic, OpenAI, OpenAI-compatible endpoint): provider, model, base URL and key.
- **Embeddings** for the knowledge base (OpenAI; reuses the OpenAI chat key when no separate key is given).
- **Meta app**: app id, app secret and webhook verify token for the official Instagram / Facebook API.
- **Default Actors**: the platform-wide `ProviderConfig` rows (organizationId = null) every workspace inherits; "Add the recommended set" seeds the standard Actors.

Every field has a **Test** button (Apify `/users/me`, one tiny AI completion, a Meta app-token request) that can test a value before it is saved. Secrets are stored encrypted (`ENCRYPTION_KEY`) in the `platform_settings` row; only previews are ever returned. Every change is audited (`platform.settings_updated`, field names only).

Resolution order everywhere: **workspace override → platform row → server environment variable → not configured**. Environment variables (`APIFY_API_TOKEN`, `AI_*`, `META_*`, `APIFY_*_ACTOR`) therefore remain a bootstrap/fallback only. The merged result is `getPlatformConfig(db)` in `@oses/database` (cached 15 s per process; the web process invalidates on write).

## Operations per workspace (overrides)

Every workspace detail page has an **Operations** section that is never visible to members:

- Discovery provider (Apify): workspace token (stored encrypted), enable/disable discovery, test the connection, and the discovery Actor configurations (workspace overrides over platform defaults).
- AI provider: platform default or a workspace-specific provider (Anthropic, OpenAI, OpenAI-compatible), model, base URL, key and temperature.
- Delivery and job limits: preferred delivery provider, concurrent jobs, retries, timeout, browser extension on/off.

Members only see a **Services** readiness list in Settings → Automation. The underlying APIs (`/api/settings/providers*`, provider/key fields of `/api/settings/automation` and `/api/ai/settings`) reject non-operators; operators act on another workspace by passing `?organizationId=`.

## System page: recent warnings & errors

Hosts such as Hostinger give no easy access to the process log, so the System page lists the last 50 warn/error log records of the running web process (`getRecentLogs()` in `@oses/shared`; same redaction as the log lines) together with the database version and SQL mode. A search whose leads could not be saved also carries the database error in its run warnings (`persisted.errors`).

## Suspension

Suspending a workspace sets `Organization.status = SUSPENDED`, pauses automation (mode Manual, autopilot off, running campaigns paused, queued jobs cancelled) and makes every app API call for its members fail with `403 ORG_SUSPENDED`; the app shows a notice with the reason. Operators can still open the workspace. Activating restores access; automation stays off until the workspace turns it on again.

## Audit

Every OS-Panel mutation writes an audit row (`os.organization_suspended`, `os.user_password_reset`, `os.job_retried`, ...) on the target organization with `meta.operator` = the operator email and `meta.via = "os-panel"`.
