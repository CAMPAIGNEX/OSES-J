/**
 * Pure-JS `prisma migrate deploy` equivalent for hosts that cannot execute Prisma's schema-engine
 * binary (EACCES on shared hosting). Applies pending SQL files from prisma/migrations in order and
 * records them in `_prisma_migrations` exactly like Prisma does (same table, same sha256 checksum),
 * so `prisma migrate` keeps working locally against the same database.
 *
 * Usage: node scripts/migrate.mjs            (reads DATABASE_URL)
 */
import { createHash, randomUUID } from "node:crypto";
import { readdirSync, readFileSync, existsSync } from "node:fs";
import { createRequire } from "node:module";
import path from "node:path";
import { fileURLToPath } from "node:url";

const here = path.dirname(fileURLToPath(import.meta.url));
const migrationsDir = path.join(here, "..", "prisma", "migrations");
const require = createRequire(import.meta.url);

function parseUrl(url) {
  if (!url) throw new Error("DATABASE_URL is not configured");
  const u = new URL(url);
  if (!/^mysql:$|^mariadb:$/.test(u.protocol)) throw new Error("DATABASE_URL must start with mysql://");
  const sslParam = u.searchParams.get("sslaccept") ?? u.searchParams.get("ssl");
  return {
    host: u.hostname,
    port: u.port ? Number(u.port) : 3306,
    user: decodeURIComponent(u.username),
    password: decodeURIComponent(u.password),
    database: u.pathname.replace(/^\//, ""),
    ssl: sslParam === "strict" ? { rejectUnauthorized: true } : sslParam === "accept_invalid_certs" || sslParam === "true" ? { rejectUnauthorized: false } : undefined,
  };
}

/** Split a Prisma migration file into statements (statements end with `;` at end of line). */
function splitStatements(sql) {
  return sql
    .split(/;\s*(?:\r?\n|$)/)
    .map((s) => s.replace(/^\s*--.*$/gm, "").trim())
    .filter((s) => s.length > 0);
}

export async function migrateDeploy({ databaseUrl = process.env.DATABASE_URL, log = console } = {}) {
  const mariadb = require("mariadb");
  const options = parseUrl(databaseUrl);
  const conn = await mariadb.createConnection({ ...options, connectTimeout: 15000, multipleStatements: false });
  const summary = { applied: [], skipped: 0, failed: null };
  try {
    const lock = await conn.query("SELECT GET_LOCK('oses_migrate', 60) AS ok");
    if (!lock[0] || Number(lock[0].ok) !== 1) throw new Error("Could not acquire migration lock");
    await conn.query(
      "CREATE TABLE IF NOT EXISTS `_prisma_migrations` (`id` VARCHAR(36) NOT NULL, `checksum` VARCHAR(64) NOT NULL, `finished_at` DATETIME(3) NULL, `migration_name` VARCHAR(255) NOT NULL, `logs` TEXT NULL, `rolled_back_at` DATETIME(3) NULL, `started_at` DATETIME(3) NOT NULL DEFAULT CURRENT_TIMESTAMP(3), `applied_steps_count` INTEGER UNSIGNED NOT NULL DEFAULT 0, PRIMARY KEY (`id`)) DEFAULT CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci",
    );
    const rows = await conn.query("SELECT migration_name, finished_at, rolled_back_at FROM `_prisma_migrations`");
    const applied = new Map(rows.map((r) => [r.migration_name, r]));
    const dirs = existsSync(migrationsDir) ? readdirSync(migrationsDir, { withFileTypes: true }).filter((d) => d.isDirectory()).map((d) => d.name).sort() : [];
    for (const name of dirs) {
      const file = path.join(migrationsDir, name, "migration.sql");
      if (!existsSync(file)) continue;
      const existing = applied.get(name);
      if (existing && existing.finished_at && !existing.rolled_back_at) {
        summary.skipped++;
        continue;
      }
      if (existing && !existing.finished_at && !existing.rolled_back_at) {
        throw new Error(`Migration ${name} previously failed part-way; resolve it manually (prisma migrate resolve) before continuing`);
      }
      const sql = readFileSync(file, "utf8");
      const checksum = createHash("sha256").update(sql).digest("hex");
      const statements = splitStatements(sql);
      const id = randomUUID();
      log.log(`[migrate] applying ${name} (${statements.length} statements)`);
      await conn.query("INSERT INTO `_prisma_migrations` (`id`, `checksum`, `migration_name`, `started_at`, `applied_steps_count`) VALUES (?, ?, ?, NOW(3), 0)", [id, checksum, name]);
      let steps = 0;
      try {
        for (const statement of statements) {
          await conn.query(statement);
          steps++;
          await conn.query("UPDATE `_prisma_migrations` SET `applied_steps_count` = ? WHERE `id` = ?", [steps, id]);
        }
        await conn.query("UPDATE `_prisma_migrations` SET `finished_at` = NOW(3) WHERE `id` = ?", [id]);
        summary.applied.push(name);
      } catch (err) {
        await conn.query("UPDATE `_prisma_migrations` SET `logs` = ? WHERE `id` = ?", [String(err && err.message ? err.message : err).slice(0, 60000), id]);
        summary.failed = { name, step: steps + 1, error: err && err.message ? err.message : String(err) };
        throw err;
      }
    }
    await conn.query("SELECT RELEASE_LOCK('oses_migrate')");
    return summary;
  } finally {
    await conn.end().catch(() => undefined);
  }
}

const isMain = process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isMain) {
  migrateDeploy()
    .then((s) => {
      console.log(`[migrate] done: applied ${s.applied.length} (${s.applied.join(", ") || "-"}), already applied ${s.skipped}`);
    })
    .catch((err) => {
      console.error(`[migrate] failed: ${err.message}`);
      process.exit(1);
    });
}
