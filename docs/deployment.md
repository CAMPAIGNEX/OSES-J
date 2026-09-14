# Deployment

OSES J is one Next.js application plus an optional worker process, backed by MySQL/MariaDB. The same build runs on Hostinger Business (shared, Node.js app) and on a VPS; only the job-runner mode differs.

## Common steps

```bash
pnpm install --frozen-lockfile
cp .env.example .env            # fill in production values
pnpm db:deploy                  # apply migrations
pnpm build                      # prisma generate + next build
pnpm start                      # next start on $PORT (default 3100)
```

Production `.env` essentials: `NODE_ENV=production`, `APP_URL=https://your-domain`, strong `AUTH_SECRET` / `ENCRYPTION_KEY` / `INTERNAL_JOB_SECRET`, `DATABASE_URL`, `STORAGE_DIR` (persistent, outside the web root), provider keys as needed. Keep `.env` out of version control (it is git-ignored).

## Option A: Hostinger Business (shared hosting, Node.js app)

1. Create a MySQL database in hPanel; put its credentials in `DATABASE_URL` (add `?connection_limit=5` to stay within shared limits).
2. Upload the repository (or `git clone`) into the app directory, run the common steps with the Node.js version set to 20+ in hPanel.
3. Set the application start command to `pnpm start` (or `node apps/web/node_modules/next/dist/bin/next start -p $PORT` if pnpm is unavailable) and the entry root to the repository.
4. Job execution — choose one:
   - `JOB_RUNNER_MODE=inline`: jobs run inside the web process right after the request that created them, and a timer in the web process (`apps/web/instrumentation.ts`) runs the scheduler plus a small job batch every minute while the app is up. Simplest; fine for one exporter as long as the host keeps the Node process alive.
   - `JOB_RUNNER_MODE=cron`: add an hPanel cron job every minute:
     ```
     * * * * * curl -s -X POST -H "Authorization: Bearer YOUR_INTERNAL_JOB_SECRET" https://your-domain/api/internal/jobs/tick > /dev/null
     ```
     Each tick runs the scheduler and a bounded batch of jobs (`JOB_TICK_BATCH_SIZE`, default 10) so it finishes well within the cron interval.
5. Point the domain to the app, enable HTTPS in hPanel.

Limits to keep in mind on shared hosting: no long-running processes (hence cron/inline), memory around 1 GB, outbound HTTP allowed (Apify, Meta, AI providers), file storage in `STORAGE_DIR` inside the account.

## Option B: VPS (Ubuntu 22.04+)

1. Install Node.js 20+/24, pnpm, MariaDB 10.6+ (or MySQL 8), nginx, and a process manager (pm2 or systemd).
2. Run the common steps as a dedicated user.
3. Processes:
   - web: `pnpm start` (`PORT=3100`)
   - worker: `pnpm worker` with `JOB_RUNNER_MODE=worker` (polls the queue with `WORKER_POLL_INTERVAL_MS`, runs the scheduler every minute, `WORKER_CONCURRENCY` parallel jobs)
   pm2 example:
   ```bash
   pm2 start "pnpm start" --name oses-web
   pm2 start "pnpm worker" --name oses-worker
   pm2 save && pm2 startup
   ```
4. nginx reverse proxy with HTTPS (certbot), `client_max_body_size 30m;` for document uploads, `proxy_read_timeout 120s;`.
5. Meta webhooks and OAuth need the public HTTPS domain configured in the Meta app (see [meta-integration.md](meta-integration.md)).

## Browser extension

Build with `pnpm extension:build` and distribute `apps/extension/dist` (zip it for sideloading, or publish to the Chrome Web Store for the organization). The extension talks to `APP_URL` over HTTPS; no extra server component is needed.

## Backups and maintenance

- Back up the MySQL database and `STORAGE_DIR` daily (documents are stored on disk, metadata in the DB).
- `TRASH_PURGE_JOB` runs daily from the scheduler and permanently deletes items older than `TRASH_RETENTION_DAYS` (7).
- `/api/health` returns `{ ok, db, mode }` for uptime monitoring.
- Logs are JSON on stdout (`LOG_LEVEL=info`); pm2/systemd or hPanel capture them.

## Upgrading

```bash
git pull
pnpm install --frozen-lockfile
pnpm db:deploy
pnpm build
pm2 restart oses-web oses-worker   # or restart the hPanel app
```
